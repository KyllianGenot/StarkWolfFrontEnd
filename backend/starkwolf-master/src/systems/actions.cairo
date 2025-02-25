use starknet::{ContractAddress, get_caller_address};
use starkwolf::models::{Player, Role, Phase, GameState};

#[starknet::interface]
pub trait IActions<T> {
    fn start_game(ref self: T, game_id: u32, players: Array<ContractAddress>);
    fn vote(ref self: T, game_id: u32, target: ContractAddress);
    fn kill(ref self: T, game_id: u32, target: ContractAddress);
}

#[dojo::contract]
pub mod actions {
    use super::{IActions, Player, Role, Phase, GameState};
    use starknet::{ContractAddress, get_caller_address};

    use dojo::model::{ModelStorage};
    use dojo::event::EventStorage;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct PlayerEliminated {
        #[key]
        pub game_id: u32,
        pub player: ContractAddress,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GameStarted {
        #[key]
        pub game_id: u32,
        pub player_count: u8,
    }

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn start_game(ref self: ContractState, game_id: u32, players: Array<ContractAddress>) {
            let mut world = self.world_default();

            let game: GameState = world.read_model(game_id);
            assert(game.phase == Phase::Lobby, 'game already started');

            let player_count = players.len();
            assert(player_count >= 3, 'not enough players');

            let mut i = 0;
            let mut werewolves = 0;
            loop {
                if i >= player_count {
                    break;
                }
                let player_addr = *players[i];
                let role = if i == 0 { Role::Werewolf } else { Role::Villager };
                if role == Role::Werewolf {
                    werewolves += 1;
                }
                let player = Player {
                    address: player_addr,
                    role,
                    is_alive: true,
                    has_voted: false,
                };
                world.write_model(@player);
                i += 1;
            };

            let new_game = GameState {
                game_id,
                phase: Phase::Night,
                players_alive: player_count.try_into().unwrap(),
                werewolves_alive: werewolves,
                day_count: 0,
            };
            world.write_model(@new_game);

            world.emit_event(@GameStarted { game_id, player_count: player_count.try_into().unwrap() });
        }

        fn vote(ref self: ContractState, game_id: u32, target: ContractAddress) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            let game: GameState = world.read_model(game_id);
            assert(game.phase == Phase::Day, 'not day phase');

            let mut voter: Player = world.read_model(caller);
            let mut target_player: Player = world.read_model(target);
            assert(voter.is_alive, 'voter is dead');
            assert(target_player.is_alive, 'target is dead');
            assert(!voter.has_voted, 'already voted');

            target_player.is_alive = false;
            voter.has_voted = true;
            world.write_model(@target_player);
            world.write_model(@voter);

            let mut new_game = game;
            new_game.players_alive -= 1;
            if target_player.role == Role::Werewolf {
                new_game.werewolves_alive -= 1;
            }
            new_game.phase = if new_game.werewolves_alive == 0 || new_game.werewolves_alive >= new_game.players_alive {
                Phase::Ended
            } else {
                Phase::Night
            };
            world.write_model(@new_game);

            world.emit_event(@PlayerEliminated { game_id, player: target });
        }

        fn kill(ref self: ContractState, game_id: u32, target: ContractAddress) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            let game: GameState = world.read_model(game_id);
            assert(game.phase == Phase::Night, 'not night phase');

            let mut killer: Player = world.read_model(caller);
            let mut target_player: Player = world.read_model(target);
            assert(killer.role == Role::Werewolf, 'not a werewolf');
            assert(killer.is_alive, 'killer is dead');
            assert(target_player.is_alive, 'target is dead');

            target_player.is_alive = false;
            world.write_model(@target_player);

            let mut new_game = game;
            new_game.players_alive -= 1;
            new_game.phase = Phase::Day;
            new_game.day_count += 1;
            world.write_model(@new_game);

            world.emit_event(@PlayerEliminated { game_id, player: target });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"starkwolf")
        }
    }
}