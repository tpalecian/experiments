import './ui/styles/index.css';
import { isAssetLabRoute, startAssetLab } from './ui/assetLab';
import { isBiomeEditorRoute, startBiomeEditor } from './ui/biomeEditor';
import { Game } from './Game';

if (isAssetLabRoute()) {
  startAssetLab();
} else if (isBiomeEditorRoute()) {
  startBiomeEditor();
} else {
  new Game();
}
