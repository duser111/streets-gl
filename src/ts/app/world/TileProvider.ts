import Tile, {StaticTileGeometry} from "../objects/Tile";
import MapWorkerManager from "./worker/MapWorkerManager";
import Config from "../Config";
import Renderer from "../../renderer/Renderer";

interface queueEntry {
	tile: Tile,
	onLoad: (...args: any[]) => any
}

export default class TileProvider {
	private mapWorkerManager: MapWorkerManager = new MapWorkerManager(Config.WebWorkersNumber);
	private queue: queueEntry[] = [];
	private renderer: Renderer;

	constructor(renderer: Renderer) {
		this.renderer = renderer;
	}

	public async getTileObjects(tile: Tile): Promise<StaticTileGeometry> {
		return new Promise<StaticTileGeometry>((resolve) => {
			this.queue.push({
				tile,
				onLoad: (data: StaticTileGeometry) => {
					resolve(this.getObjectFromMessage(data));
				}
			});
		});
	}

	public update() {
		this.removeDisposedTiles();

		while (this.queue.length > 0 && this.mapWorkerManager.getFreeWorker()) {
			const worker = this.mapWorkerManager.getFreeWorker();
			const {tile, onLoad} = this.getNearestTileInQueue();

			worker.start(tile.x, tile.y).then(result => {
				onLoad(result);
			}, error => {
				console.error(error, `${tile.x}, ${tile.y}`);
				this.queue.unshift({tile, onLoad});
			});
		}
	}

	private removeDisposedTiles() {
		this.queue.filter((entry: queueEntry) => {
			return !entry.tile.disposed;
		});
	}

	private getNearestTileInQueue(): queueEntry {
		this.queue.sort((a: queueEntry, b: queueEntry): number => {
			return b.tile.distanceToCamera - a.tile.distanceToCamera;
		});

		return this.queue.pop();
	}

	private getObjectFromMessage(msg: StaticTileGeometry): StaticTileGeometry {
		return msg;
	}
}
