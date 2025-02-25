import { RpcProvider, Account, Contract, shortString, CallData } from 'starknet';
import { promisify } from 'util';
import fs from 'fs';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

/**
 * Type for a Starknet contract address (hex string starting with 0x)
 */
type ContractAddress = string;

/**
 * Type for a Starknet account address (hex string starting with 0x)
 */
type AccountAddress = string;

/**
 * Main class to interact with the StarkWolf game contract
 */
export class StarkWolfGame {
    private contract: Contract;
    private provider: RpcProvider;
    private accounts: Map<string, Account>;
    private grpcClient: any;

    /**
     * Creates a new instance of the StarkWolfGame
     * @param contractAddress - The address of the deployed game contract
     * @param nodeUrl - The URL of the Starknet node (defaults to local devnet)
     * @param grpcUrl - The URL of the gRPC server (defaults to localhost:8080)
     */
    constructor(
        contractAddress: ContractAddress,
        nodeUrl: string = 'https://api.cartridge.gg/x/starkwolf/katana',
        grpcUrl: string = 'http://localhost:8080'
    ) {
        this.provider = new RpcProvider({ nodeUrl });
        this.accounts = new Map();
        
        // Load ABI from JSON file
        const abiPath = './abi_actions.json';
        const abiData = fs.readFileSync(abiPath, 'utf-8');
        const abi = JSON.parse(abiData).abi;
        this.contract = new Contract(abi, contractAddress, this.provider);
    }

    addAccount(address: string, privateKey: string) {
        this.accounts.set(address, new Account(this.provider, address, privateKey));
    }

    /**
     * Helper function to retry failed transactions
     */
    private async retryTransaction<T>(
        operation: () => Promise<T>,
        maxAttempts: number = 5,
        delayMs: number = 2000
    ): Promise<T> {
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts) {
                    console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        throw lastError;
    }

    /**
     * Starts a new game with the specified players
     * @param gameId - Unique identifier for the game
     * @param players - Array of player account addresses to participate in the game
     * @param starterAddress - Account address of the player starting the game
     * @returns Transaction receipt
     */
    async startGame(gameId: number, players: AccountAddress[], starterAddress: string) {
        try {
            const starterAccount = this.accounts.get(starterAddress);
            if (!starterAccount) throw new Error('Starter account not found');
            
            this.contract.connect(starterAccount);

            // Vérifier si une partie existe déjà avec cet ID
            try {
                const gameState = await this.contract.get_game_state(gameId);
                console.log('Existing game state:', gameState);
                throw new Error('Game already exists with this ID');
            } catch (error) {
                // Si nous avons une erreur ici, c'est probablement parce que le jeu n'existe pas encore
                // ce qui est ce que nous voulons
                console.log('No existing game found, creating new game...');
            }

            const calldata = CallData.compile({
                game_id: gameId,
                players: players
            });

            return await this.retryTransaction(async () => {
                const tx = await this.contract.start_game(calldata);
                await this.provider.waitForTransaction(tx.transaction_hash);
                return tx;
            });
        } catch (error) {
            console.error('Error starting game:', error);
            throw error;
        }
    }

    /**
     * Casts a vote against a target player
     * @param gameId - Identifier of the active game
     * @param target - Account address of the player being voted against
     * @param voterAddress - Account address of the voter
     * @returns Transaction receipt
     */
    async vote(gameId: number, target: AccountAddress, voterAddress: string) {
        try {
            const voterAccount = this.accounts.get(voterAddress);
            if (!voterAccount) throw new Error('Voter account not found');
            
            this.contract.connect(voterAccount);
            const calldata = CallData.compile({
                game_id: gameId,
                target: target
            });
            
            return await this.retryTransaction(async () => {
                console.log('Sending vote transaction...');
                const tx = await this.contract.vote(calldata);
                console.log('Transaction sent, waiting for confirmation...');
                await this.provider.waitForTransaction(tx.transaction_hash);
                console.log('Vote confirmed');
                return tx;
            });
        } catch (error) {
            console.error('Error voting:', error);
            throw error;
        }
    }

    /**
     * Executes a kill action against a target player (for werewolves)
     * @param gameId - Identifier of the active game
     * @param target - Account address of the player to kill
     * @param killerAddress - Account address of the werewolf
     * @returns Transaction receipt
     */
    async werewolfAction(gameId: number, target: AccountAddress, killerAddress: string) {
        try {
            const killerAccount = this.accounts.get(killerAddress);
            if (!killerAccount) throw new Error('Killer account not found');
            
            this.contract.connect(killerAccount);
            const calldata = CallData.compile({
                game_id: gameId,
                target: target
            });

            return await this.retryTransaction(async () => {
                console.log('Sending night action transaction...');
                const tx = await this.contract.night_action(calldata);
                console.log('Transaction sent, waiting for confirmation...');
                await this.provider.waitForTransaction(tx.transaction_hash);
                console.log('Night action confirmed');
                return tx;
            });
        } catch (error) {
            console.error('Error performing night action:', error);
            throw error;
        }
    }

    /**
     * Pairs two players as lovers using Cupid's ability
     * @param gameId - Identifier of the active game
     * @param lover1 - Account address of the first player to pair
     * @param lover2 - Account address of the second player to pair
     * @param cupidAddress - Account address of the Cupid
     * @returns Transaction receipt
     */
    async cupidAction(gameId: number, lover1: AccountAddress, lover2: AccountAddress, cupidAddress: string) {
        try {
            const cupidAccount = this.accounts.get(cupidAddress);
            if (!cupidAccount) throw new Error('Cupid account not found');
            
            this.contract.connect(cupidAccount);
            const calldata = CallData.compile({
                game_id: gameId,
                lover1: lover1,
                lover2: lover2
            });

            return await this.retryTransaction(async () => {
                const tx = await this.contract.cupid_action(calldata);
                await this.provider.waitForTransaction(tx.transaction_hash);
                console.log('Lovers paired successfully');
                return tx;
            });
        } catch (error) {
            console.error('Error pairing lovers:', error);
            throw error;
        }
    }

    /**
     * Ends the voting phase
     * @param gameId - Identifier of the active game
     * @returns Transaction receipt
     */
    async endVoting(gameId: number) {
        try {
            const calldata = CallData.compile({
                game_id: gameId
            });
            
            const tx = await this.contract.end_voting(calldata);
            await this.provider.waitForTransaction(tx.transaction_hash);
            console.log('Voting phase ended');
            return tx;
        } catch (error) {
            console.error('Error ending voting phase:', error);
            throw error;
        }
    }

    /**
     * Executes the hunter's revenge shot after being killed
     * @param gameId - Identifier of the active game
     * @param target - Account address of the player to shoot
     * @param hunterAddress - Account address of the dead hunter
     * @returns Transaction receipt
     */
    async hunterAction(gameId: number, target: AccountAddress, hunterAddress: string) {
        try {
            const hunterAccount = this.accounts.get(hunterAddress);
            if (!hunterAccount) throw new Error('Hunter account not found');
            
            this.contract.connect(hunterAccount);
            const calldata = CallData.compile({
                game_id: gameId,
                target: target
            });

            return await this.retryTransaction(async () => {
                console.log('Hunter attempting revenge shot...');
                const tx = await this.contract.hunter_action(calldata);  // Utiliser hunter_action
                console.log('Transaction sent, waiting for confirmation...');
                await this.provider.waitForTransaction(tx.transaction_hash);
                console.log('Hunter shot confirmed');
                return tx;
            });
        } catch (error) {
            console.error('Error performing hunter action:', error);
            throw error;
        }
    }

    // Méthode pour écouter les événements
    async subscribeToEvents() {
        try {
            console.log('Subscribing to events...');
            const stream = this.grpcClient.subscribe({
                world_address: '0x07035caa481bbaefbe5b48941b3f44011c46105865a0c89a0bb5f4e1f0e929ed'
            });

            stream.on('data', (data: any) => {
                console.log('Received event:', data);
            });

            stream.on('error', (error: any) => {
                console.error('Stream error:', error);
                // Ne pas arrêter le programme en cas d'erreur de stream
                // Le jeu peut continuer sans les événements
            });

            stream.on('end', () => {
                console.log('Stream ended');
            });

            // Continuer l'exécution même si le stream échoue
            return Promise.resolve();
        } catch (error) {
            console.error('Error subscribing to events:', error);
            // Ne pas bloquer l'exécution du programme
            return Promise.resolve();
        }
    }
}

// Example usage
async function main() {
    try {
        const contractAddress = '0x030caf705ec459e733e170c2ca7603642ae1ce52eaa3ac535f503c3a2ec6263e';
        console.log('Contract address:', contractAddress);

        const game = new StarkWolfGame(contractAddress);

        // Setup accounts and roles
        const accounts = Array.from({length: 7}, (_, i) => {
            const address = process.env[`PLAYER${i}_ADDRESS`];
            const privateKey = process.env[`PLAYER${i}_PRIVATE_KEY`];
            
            if (!address || !privateKey) {
                throw new Error(`Missing environment variables for player ${i}`);
            }
            return { address: address as string, privateKey: privateKey as string };
        });

        accounts.forEach(account => game.addAccount(account.address, account.privateKey));
        const players = accounts.map(account => account.address);

        const roles = {
            werewolf: players[0],
            witch: players[1],
            guard: players[2],
            seer: players[3],
            hunter: players[4],
            cupid: players[5],
            villager: players[6]
        };

        const gameId = Math.floor(Math.random() * 1000);
        console.log('Starting game with ID:', gameId);

        // Suivre la séquence du test Cairo
        game.startGame(gameId, players, roles.werewolf)
            .then(async () => {
                console.log("Game started successfully");
                await new Promise(resolve => setTimeout(resolve, 3000));
                return game.cupidAction(gameId, roles.villager, roles.guard, roles.cupid);
            })
            .then(async () => {
                console.log("Lovers paired successfully");
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log("Guard protecting seer...");
                return game.werewolfAction(gameId, roles.seer, roles.guard);
            })
            .then(async () => {
                console.log("Guard action completed");
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log("Werewolf attempting to kill seer (but protected)...");
                return game.werewolfAction(gameId, roles.seer, roles.werewolf);
            })
            .then(async () => {
                console.log("Night phase completed");
                await new Promise(resolve => setTimeout(resolve, 2000));
                // Plusieurs votes contre le hunter
                console.log("Voting phase begins...");
                return game.vote(gameId, roles.hunter, roles.werewolf);
            })
            .then(async () => {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return game.vote(gameId, roles.hunter, roles.witch);
            })
            .then(async () => {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return game.vote(gameId, roles.hunter, roles.guard);
            })
            .then(async () => {
                console.log("Votes cast against hunter");
                await new Promise(resolve => setTimeout(resolve, 2000));
                return game.endVoting(gameId);
            })
            .then(async () => {
                console.log("Day phase ended, hunter eliminated");
                await new Promise(resolve => setTimeout(resolve, 2000));
                // Nouvelle nuit
                console.log("Guard protecting cupid...");
                return game.werewolfAction(gameId, roles.cupid, roles.guard);
            })
            .then(async () => {
                console.log("Witch killing villager...");
                return game.hunterAction(gameId, roles.villager, roles.hunter);
            })
            .then(async () => {
                console.log("Werewolf killing cupid...");
                return game.werewolfAction(gameId, roles.cupid, roles.werewolf);
            })
            .then(async () => {
                console.log("Night actions completed");
                await new Promise(resolve => setTimeout(resolve, 2000));
                // Votes finaux contre le loup
                return game.vote(gameId, roles.werewolf, roles.witch);
            })
            .then(async () => {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return game.vote(gameId, roles.werewolf, roles.seer);
            })
            .then(async () => {
                console.log("Final votes cast");
                await new Promise(resolve => setTimeout(resolve, 2000));
                return game.endVoting(gameId);
            })
            .then(() => console.log("Game ended - villagers win!"))
            .catch((error) => console.error("An error occurred:", error));
    } catch (error) {
        console.error("Failed to initialize game:", error);
    }
}

main();