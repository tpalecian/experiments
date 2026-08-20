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
  makeDirtSkirt,
  makeFence,
  makeFlowerTuft,
  makeHarborLabel,
  makeHarborPier,
  makeHexTile,
  makeLabelSprite,
  makeMesa,
  makeNumberToken,
  makePastureRock,
  makePine,
  makeRock,
  makeSheep,
  makeStoneWall,
  makeTree,
  makeWheatStalk,
} from './props';
export { ASSET_CATALOG, ASSET_CATEGORIES, getAssetById } from './catalog';
