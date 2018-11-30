import { GameManager } from "./GameManager";
import { PlayerManager, STATE } from "./PlayerManager";

export default class Lobby {
    private game: GameManager;

    public get PlayerManager(): PlayerManager {
        return this.game.playerManager;
    }

    public get waittingNum(): number {
        return this.PlayerManager.FindPlayersIsSameState(STATE.WAITING).length;
    }

    constructor(game: GameManager) {
        this.game = game;
    }

    public Match(): string[] {
        const waitingList = this.PlayerManager.FindPlayersIsSameState(STATE.WAITING);
        const sample: string[] = [];
        for (let i = 0; i < 4; i++) {
            const index = ~~(Math.random() * waitingList.length);
            sample.push(waitingList[index].uuid);
            waitingList.splice(index, 1);
        }
        for (const uuid of sample) {
            const index = this.PlayerManager.FindPlayerByUUID(uuid);
            this.PlayerManager.PlayerList[index].state = STATE.MATCHED;
        }
        return sample;
    }
}
