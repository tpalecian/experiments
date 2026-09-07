import './ui/styles/index.css';
import { isAssetLabRoute, startAssetLab } from './ui/assetLab';
import { isBiomeEditorRoute, startBiomeEditor } from './ui/biomeEditor';
import { isReviewRoute } from './ui/reviewRoute';
import { startReviewScene } from './ui/reviewScene';
import { Game } from './Game';

if (isAssetLabRoute()) {
  startAssetLab();
} else if (isBiomeEditorRoute()) {
  startBiomeEditor();
} else if (isReviewRoute()) {
  startReviewScene();
} else {
  new Game();
}
