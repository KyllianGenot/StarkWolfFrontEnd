
#[cfg(test)]
mod tests {
    use dojo_cairo_test::WorldStorageTestTrait;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorageTrait;
    use dojo_cairo_test::{
        spawn_test_world, NamespaceDef, TestResource, ContractDefTrait, ContractDef,
    };
    use core::fmt::{Display, Formatter, Error};

    use starkwolf::systems::actions::{actions, IActionsDispatcher, IActionsDispatcherTrait};
    use starkwolf::models::{Player, m_Player, GameState, m_GameState, Role, Phase};

    impl PhaseDisplay of Display<Phase> {
        fn fmt(self: @Phase, ref f: Formatter) -> Result<(), Error> {
            let mut str: ByteArray = "Error";
            match self {
                Phase::Lobby => {str = "Lobby";},
                Phase::Night => {str = "Night";},
                Phase::Day => {str = "Day";},
                Phase::Ended => {str = "Ended";},
            }
            f.buffer.append(@str);
            Result::Ok(())
        }
    }

    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: "starkwolf",
            resources: [
                TestResource::Model(m_Player::TEST_CLASS_HASH),
                TestResource::Model(m_GameState::TEST_CLASS_HASH),
                TestResource::Event(actions::e_PlayerEliminated::TEST_CLASS_HASH),
                TestResource::Event(actions::e_GameStarted::TEST_CLASS_HASH),
                TestResource::Contract(actions::TEST_CLASS_HASH),
            ].span(),
        };
        ndef
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"starkwolf", @"actions")
                .with_writer_of([dojo::utils::bytearray_hash(@"starkwolf")].span())
        ].span()
    }

    #[test]
    #[available_gas(30000000)]
    fn test_game_flow() {
        let caller = starknet::contract_address_const::<0x1>();
        let player2 = starknet::contract_address_const::<0x2>();
        let player3 = starknet::contract_address_const::<0x3>();

        let ndef = namespace_def();
        let mut world = spawn_test_world([ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        let players = array![caller, player2, player3];
        actions_system.start_game(1, players);

        let game: GameState = world.read_model(1);
        assert(game.phase == Phase::Night, 'wrong initial phase');
        assert(game.players_alive == 3, 'wrong player count');
        assert(game.werewolves_alive == 1, 'wrong werewolf count');

        println!("{}", game.phase);

        // starknet::testing::set_caller_address(caller);
        // actions_system.kill(1, player2);
        // let game: GameState = world.read_model(1);
        // let victim: Player = world.read_model(player2);
        // assert(game.phase == Phase::Day, 'should be day');
        // assert(game.players_alive == 2, 'wrong alive count');
        // assert(!victim.is_alive, 'victim should be dead');

        // starknet::testing::set_caller_address(player3);
        // actions_system.vote(1, caller);
        // let game: GameState = world.read_model(1);
        // let wolf: Player = world.read_model(caller);
        // assert(game.phase == Phase::Ended, 'game should end');
        // assert(game.werewolves_alive == 0, 'werewolf should be dead');
        // assert(!wolf.is_alive, 'wolf should be dead');
    }
}