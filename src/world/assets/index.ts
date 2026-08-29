/**
 * Procedural mesh factories shared by World and the Asset Lab.
 */
export type { AssetCategory, AssetCreateOptions, AssetDefinition } from './types';
export { TILE_HEIGHT, hexShape, numberTexture, resolvePlayerColor } from './types';
export {
  makeCity,
  makeRoad,
  makeRobber,
  makeSettlement,
} from './pieces';
export {
  makeBush,
  makeCactus,
  makeBarn,
  makeDirtSkirt,
  makeFallenLog,
  makeFence,
  makeFlowerTuft,
  makeHarborLabel,
  makeHarborPier,
  makeHexTile,
  makeLabelSprite,
  makeMesa,
  makeMountain,
  makeNumberToken,
  makeOasis,
  makePastureRock,
  makePine,
  makeRock,
  makeSheep,
  makeStoneWall,
  makeTree,
  makeWheatStalk,
  makeWindmill,
} from './props';
export { ASSET_CATALOG, ASSET_CATEGORIES, getAssetById } from './catalog';
