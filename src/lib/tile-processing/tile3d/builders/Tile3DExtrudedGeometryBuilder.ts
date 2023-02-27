import Tile3DExtrudedGeometry from "~/lib/tile-processing/tile3d/features/Tile3DExtrudedGeometry";
import AABB3D from "~/lib/math/AABB3D";
import MathUtils from "~/lib/math/MathUtils";
import OSMReference, {OSMReferenceType} from "~/lib/tile-processing/vector/features/OSMReference";
import Vec2 from "~/lib/math/Vec2";
import Tile3DRing, {Tile3DRingType} from "~/lib/tile-processing/tile3d/builders/Tile3DRing";
import {colorToComponents} from "~/lib/tile-processing/tile3d/builders/utils";
import Tile3DMultipolygon from "~/lib/tile-processing/tile3d/builders/Tile3DMultipolygon";
import FlatRoofBuilder from "~/lib/tile-processing/tile3d/builders/roofs/FlatRoofBuilder";
import SkillionRoofBuilder from "~/lib/tile-processing/tile3d/builders/roofs/SkillionRoofBuilder";
import RoofBuilder, {
	RoofGeometry,
	RoofParams,
	RoofSkirt
} from "~/lib/tile-processing/tile3d/builders/roofs/RoofBuilder";
import PyramidalRoofBuilder from "~/lib/tile-processing/tile3d/builders/roofs/PyramidalRoofBuilder";
import HippedRoofBuilder from "~/lib/tile-processing/tile3d/builders/roofs/HippedRoofBuilder";
import RoofGeometryValidator from "~/lib/tile-processing/tile3d/builders/roofs/RoofGeometryValidator";
import GabledRoofBuilder from "~/lib/tile-processing/tile3d/builders/roofs/GabledRoofBuilder";
import MansardRoofBuilder from "~/lib/tile-processing/tile3d/builders/roofs/MansardRoofBuilder";
import QuadrupleSaltboxRoofBuilder from "~/lib/tile-processing/tile3d/builders/roofs/QuadrupleSaltboxRoofBuilder";
import WallsBuilder from "~/lib/tile-processing/tile3d/builders/WallsBuilder";
import OrientedGabledRoofBuilder from "~/lib/tile-processing/tile3d/builders/roofs/OrientedGabledRoofBuilder";

export enum RoofType {
	Flat,
	Gabled,
	Hipped,
	Pyramidal,
	Dome,
	Skillion,
	Mansard,
	QuadrupleSaltbox
}

export default class Tile3DExtrudedGeometryBuilder {
	private readonly osmReference: OSMReference;
	private readonly arrays: {
		position: number[];
		uv: number[];
		normal: number[];
		textureId: number[];
		color: number[];
	} = {
		position: [],
		uv: [],
		normal: [],
		textureId: [],
		color: []
	};
	private readonly multipolygon: Tile3DMultipolygon = new Tile3DMultipolygon();
	private readonly boundingBox: AABB3D = new AABB3D();

	public constructor(osmReference: OSMReference) {
		this.osmReference = osmReference;
	}

	public addRing(type: Tile3DRingType, nodes: Vec2[]): void {
		const ring = new Tile3DRing(type, nodes);
		this.multipolygon.addRing(ring);
	}

	public addWalls(
		{
			minHeight,
			height,
			skirt,
			levels,
			windowWidth,
			color,
			textureId
		}: {
			minHeight: number;
			height: number;
			skirt: RoofSkirt;
			levels: number;
			windowWidth: number;
			color: number;
			textureId: number;
		}
	): void {
		if (skirt) {
			for (const polyline of skirt) {
				const vertices = polyline.map(point => point.position);
				const heights =  polyline.map(point => point.height);

				const walls = new WallsBuilder().build({
					vertices,
					minHeight: height,
					height: heights,
					levels,
					windowWidth
				});
				this.addAndPaintGeometry({
					position: walls.position,
					normal: walls.normal,
					uv: walls.uv,
					color,
					textureId
				});
			}
		}

		for (const ring of this.multipolygon.rings) {
			const walls = new WallsBuilder().build({
				vertices: ring.nodes.slice(),
				minHeight,
				height: height,
				levels,
				windowWidth
			});
			this.addAndPaintGeometry({
				position: walls.position,
				normal: walls.normal,
				uv: walls.uv,
				color,
				textureId
			});
		}

		if (minHeight > 0) {
			const roof = new FlatRoofBuilder().build({
				multipolygon: this.multipolygon,
				buildingHeight: minHeight,
				height: 0,
				minHeight: minHeight,
				flip: true,
				direction: 0,
				angle: 0,
				orientation: null
			});
			this.addAndPaintGeometry({
				position: roof.position,
				normal: roof.normal,
				uv: roof.uv,
				color,
				textureId
			});
		}
	}

	public addRoof(
		{
			type,
			buildingHeight,
			minHeight,
			height,
			direction,
			angle,
			orientation,
			color,
			textureId
		}: {
			type: RoofType;
			buildingHeight: number;
			minHeight: number;
			height: number;
			direction: number;
			angle: number;
			orientation: 'along' | 'across';
			color: number;
			textureId: number;
		}
	): {skirt?: RoofSkirt; facadeHeightOverride?: number} {
		let builder: RoofBuilder;

		//type = RoofType.Gabled as RoofType;

		switch (type) {
			case RoofType.Skillion: {
				builder = new SkillionRoofBuilder();
				break;
			}
			case RoofType.Pyramidal: {
				builder = new PyramidalRoofBuilder();
				break;
			}
			case RoofType.Hipped: {
				builder = new HippedRoofBuilder();
				break;
			}
			case RoofType.Gabled: {
				if (orientation === 'along' || orientation === 'across') {
					builder = new OrientedGabledRoofBuilder();
				} else {
					builder = new GabledRoofBuilder();
				}
				break;
			}
			case RoofType.Mansard: {
				builder = new MansardRoofBuilder();
				break;
			}
			case RoofType.QuadrupleSaltbox: {
				builder = new QuadrupleSaltboxRoofBuilder();
				break;
			}
			default: {
				builder = new FlatRoofBuilder();
				break;
			}
		}

		const roof = this.buildRoofSafe(builder, {
			multipolygon: this.multipolygon,
			buildingHeight: buildingHeight,
			height: height,
			minHeight: minHeight,
			flip: false,
			direction: direction,
			angle: angle,
			orientation: orientation
		});
		this.addAndPaintGeometry({
			position: roof.position,
			normal: roof.normal,
			uv: roof.uv,
			color: ~~(Math.random() * 0xffffff),
			textureId: textureId
		});

		return {
			skirt: roof.addSkirt ? roof.skirt : null,
			facadeHeightOverride: roof.facadeHeightOverride
		};
	}

	private buildRoofSafe(builder: RoofBuilder, params: RoofParams): RoofGeometry {
		let roof = builder.build(params);

		if (roof === null || !RoofGeometryValidator.validate(roof, params.multipolygon)) {
			roof = new FlatRoofBuilder().build(params);
		}

		return roof;
	}

	private addAndPaintGeometry(
		{
			position,
			normal,
			uv,
			color,
			textureId
		}: {
			position: number[];
			normal: number[];
			uv: number[];
			color: number;
			textureId: number;
		}
	): void {
		this.arrays.position.push(...position);
		this.arrays.normal.push(...normal);
		this.arrays.uv.push(...uv);

		const vertexCount = position.length / 3;
		const colorComponents = colorToComponents(color);

		for (let i = 0; i < vertexCount; i++) {
			this.arrays.color.push(...colorComponents);
			this.arrays.textureId.push(textureId);
		}
	}

	private getIDBuffer(): Uint32Array {
		const idBuffer = new Uint32Array(2);
		const osmType = this.osmReference.type;
		const osmId = this.osmReference.id;

		if (osmType === OSMReferenceType.Way || osmType === OSMReferenceType.Relation) {
			const typeInt = osmType === OSMReferenceType.Way ? 0 : 1;

			idBuffer[0] = Math.min(osmId, 0xffffffff);
			idBuffer[1] = MathUtils.shiftLeft(typeInt, 19) + MathUtils.shiftRight(typeInt, 32);
		}

		return idBuffer;
	}

	public getGeometry(): Tile3DExtrudedGeometry {
		return {
			type: 'extruded',
			boundingBox: this.boundingBox,
			positionBuffer: new Float32Array(this.arrays.position),
			normalBuffer: new Float32Array(this.arrays.normal),
			uvBuffer: new Float32Array(this.arrays.uv),
			textureIdBuffer: new Uint8Array(this.arrays.textureId),
			colorBuffer: new Uint8Array(this.arrays.color),
			idBuffer: this.getIDBuffer()
		};
	}
}