import type { EngineSnapshot, GameEngine } from '../engine/engine';
import type { PlayerId, Resource, ResourceBank } from '../engine/types';
import { RESOURCES, bankTotal, emptyBank } from '../engine/types';
import { tradeRate } from '../engine/rules';
import { MAP_SIZE_ORDER, MAP_SIZES, type MapSizeId } from '../engine/board';

const RES_COLORS: Record<Resource, string> = {
  wood: '#3f8f4a',
  brick: '#d4784a',
  sheep: '#7bc95a',
  wheat: '#f0c84a',
  ore: '#8a92a6',
};

export class Hud {
  private root: HTMLElement;
  private lobby: HTMLElement;
  private tradeOpen = false;
  private discardDraft: ResourceBank = emptyBank();
  private selectedMap: MapSizeId = 'standard';
  private lastDiceKey = '';
  private assetLabHref = '?view=assets';
  private biomeEditorHref = '?view=biome-editor';
  private onResetView: (() => void) | null = null;

  constructor(
    hudEl: HTMLElement,
    lobbyEl: HTMLElement,
    private engine: GameEngine,
  ) {
    this.root = hudEl;
    this.lobby = lobbyEl;
    this.renderLobby();
    this.engine.subscribe(() => this.render());
  }

  setAssetLabHref(href: string): void {
    this.assetLabHref = href;
    if (this.engine.snapshot().phase === 'lobby') this.renderLobby();
  }

  setBiomeEditorHref(href: string): void {
    this.biomeEditorHref = href;
    if (this.engine.snapshot().phase === 'lobby') this.renderLobby();
  }

  setResetView(fn: () => void): void {
    this.onResetView = fn;
  }

  private prefersTap(): boolean {
    return window.matchMedia('(pointer: coarse), (max-width: 720px)').matches;
  }

  private renderLobby(): void {
    this.lobby.classList.remove('hidden');
    this.selectedMap = this.selectedMap ?? 'standard';
    this.lobby.innerHTML = `
      <div class="lobby-card">
        <h1>Catan</h1>
        <p>A stylized island diorama. Pick a map size, then players.</p>
        <div class="lobby-section">
          <div class="lobby-label">Map size</div>
          <div class="lobby-actions map-sizes">
            ${MAP_SIZE_ORDER.map((id) => {
              const m = MAP_SIZES[id];
              const active = this.selectedMap === id ? 'active' : '';
              return `<button class="btn secondary ${active}" data-map="${id}" type="button">
                <span class="map-title">${m.label}</span>
                <span class="map-blurb">${m.blurb} · ${m.winVp} VP</span>
              </button>`;
            }).join('')}
          </div>
        </div>
        <div class="lobby-section">
          <div class="lobby-label">Players</div>
          <div class="lobby-actions">
            <button class="btn" data-players="2">2 Players</button>
            <button class="btn" data-players="3">3 Players</button>
            <button class="btn" data-players="4">4 Players</button>
          </div>
        </div>
        <div class="lobby-section lobby-dev">
          <a class="btn secondary lobby-asset-lab" href="${escapeHtml(this.assetLabHref)}">Asset Lab</a>
          <a class="btn secondary lobby-asset-lab" href="${escapeHtml(this.biomeEditorHref)}">Biome Editor</a>
        </div>
      </div>
    `;
    this.lobby.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedMap = btn.dataset.map as MapSizeId;
        this.renderLobby();
      });
    });
    this.lobby.querySelectorAll<HTMLButtonElement>('[data-players]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.players);
        this.engine.startGame(n, this.selectedMap);
        this.lobby.classList.add('hidden');
      });
    });
  }

  render(): void {
    const s = this.engine.snapshot();
    if (s.phase === 'lobby') {
      this.root.innerHTML = '';
      this.lobby.classList.remove('hidden');
      this.lastDiceKey = '';
      return;
    }

    const current = s.players[s.currentPlayer];
    const diceKey = s.lastRoll !== null ? `${s.lastRoll[0]}:${s.lastRoll[1]}` : '';
    const diceFresh = diceKey !== '' && diceKey !== this.lastDiceKey;
    this.lastDiceKey = diceKey;
    const rollHtml =
      s.lastRoll !== null
        ? `<span class="dice-roll${diceFresh ? ' fresh' : ''}" aria-label="Dice ${s.lastRoll[0]} and ${s.lastRoll[1]}">
            <span class="die">${s.lastRoll[0]}</span>
            <span class="die-plus">+</span>
            <span class="die">${s.lastRoll[1]}</span>
            <span class="die-eq">=</span>
            <span class="die-total">${s.lastRoll[0] + s.lastRoll[1]}</span>
          </span>`
        : `<span class="dice-roll empty">—</span>`;

    this.root.innerHTML = `
      <div class="top-bar">
        <div class="panel msg-panel">
          <h2 class="msg-title">${escapeHtml(s.message)}</h2>
          <p class="msg">
            <span class="msg-dice">${rollHtml}</span>
            <span class="msg-meta"> · ${MAP_SIZES[s.mapSize].label} · Win at ${s.winVp} VP · Phase: ${s.phase}${s.longestRoadOwner !== null ? ` · Longest Road: ${s.players[s.longestRoadOwner].name}` : ''}</span>
          </p>
          ${s.productionLog ? `<p class="log${diceFresh ? ' log-enter' : ''}">${escapeHtml(s.productionLog)}</p>` : ''}
        </div>
        <div class="panel players">
          ${s.players
            .map(
              (p) => `
            <div class="player-row ${p.id === s.currentPlayer ? 'current' : ''}">
              <span class="swatch" style="background:#${p.color.toString(16).padStart(6, '0')}"></span>
              <span class="player-name">${p.name}</span>
              <span class="player-vp">${p.victoryPoints} VP</span>
              <span class="player-cards">${bankTotal(p.resources)} cards</span>
            </div>`,
            )
            .join('')}
        </div>
      </div>
      <div class="bottom-bar">
        <div class="panel resources-panel">
          <div class="resources-label">${current.name}'s resources</div>
          <div class="resources">
            ${RESOURCES.map(
              (r) => `
              <span class="res-chip"><span class="res-dot" style="background:${RES_COLORS[r]}"></span><span class="res-name">${r}</span> ${current.resources[r]}</span>`,
            ).join('')}
          </div>
        </div>
        <div class="actions">
          ${this.actionButtons(s)}
        </div>
      </div>
      ${this.modals(s)}
    `;

    this.bindActions(s);
  }

  private actionButtons(s: EngineSnapshot): string {
    if (s.phase === 'gameOver') {
      return `<button class="btn btn-cta" data-action="restart">Play again</button>`;
    }
    if (s.phase === 'roll') {
      return `<button class="btn btn-cta" data-action="roll">Roll dice</button>`;
    }
    if (s.phase === 'main') {
      return `
        <button class="btn secondary ${s.buildMode === 'road' ? 'active' : ''}" data-action="build-road">Road</button>
        <button class="btn secondary ${s.buildMode === 'settlement' ? 'active' : ''}" data-action="build-settlement">Settlement</button>
        <button class="btn secondary ${s.buildMode === 'city' ? 'active' : ''}" data-action="build-city">City</button>
        <button class="btn secondary" data-action="trade">Bank trade</button>
        <button class="btn btn-cta" data-action="end">End turn</button>
      `;
    }
    if (s.phase === 'setupSettlement' || s.phase === 'setupRoad' || s.phase === 'robber') {
      const hint = this.prefersTap() ? 'Tap the board' : 'Click the board';
      return `
        <span class="board-hint">${hint}</span>
        <button class="btn secondary" data-action="reset-view">Reset view</button>
      `;
    }
    return '';
  }

  private modals(s: EngineSnapshot): string {
    let html = '';

    if (s.phase === 'discard' && s.discardRemaining.size > 0) {
      const pid = [...s.discardRemaining.keys()][0];
      const need = s.discardRemaining.get(pid)!;
      const p = s.players[pid];
      html += `
        <div class="modal" id="discard-modal">
          <div class="modal-card">
            <h3>${p.name}: discard ${need} cards</h3>
            <p class="msg">You have ${bankTotal(p.resources)} cards. Choose exactly ${need} to discard.</p>
            <div class="discard-grid">
              ${RESOURCES.map(
                (r) => `
                <label>${r} (max ${p.resources[r]})
                  <input type="number" min="0" max="${p.resources[r]}" value="${this.discardDraft[r] || 0}" data-res="${r}" />
                </label>`,
              ).join('')}
            </div>
            <button class="btn" data-action="confirm-discard" data-player="${pid}">Confirm discard</button>
          </div>
        </div>`;
    }

    if (s.phase === 'steal') {
      html += `
        <div class="modal" id="steal-modal">
          <div class="modal-card">
            <h3>Steal a resource</h3>
            <div class="steal-list">
              ${s.stealTargets
                .map(
                  (pid) =>
                    `<button class="btn secondary" data-action="steal" data-player="${pid}">${s.players[pid].name} (${bankTotal(s.players[pid].resources)} cards)</button>`,
                )
                .join('')}
            </div>
          </div>
        </div>`;
    }

    if (this.tradeOpen && s.phase === 'main') {
      const rates = RESOURCES.map((r) => `${r}: ${tradeRate(s.board, s.currentPlayer, r)}:1`).join(' · ');
      html += `
        <div class="modal" id="trade-modal">
          <div class="modal-card">
            <h3>Bank trade</h3>
            <p class="msg">${rates}</p>
            <div class="trade-grid" style="grid-template-columns:1fr 1fr">
              <label>Give
                <select id="trade-give">
                  ${RESOURCES.map((r) => `<option value="${r}">${r}</option>`).join('')}
                </select>
              </label>
              <label>Receive
                <select id="trade-receive">
                  ${RESOURCES.map((r) => `<option value="${r}">${r}</option>`).join('')}
                </select>
              </label>
            </div>
            <div style="display:flex;gap:0.5rem">
              <button class="btn" data-action="confirm-trade">Trade</button>
              <button class="btn secondary" data-action="close-trade">Cancel</button>
            </div>
          </div>
        </div>`;
    }

    return html;
  }

  private bindActions(s: EngineSnapshot): void {
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        switch (action) {
          case 'roll':
            this.engine.rollDice();
            break;
          case 'end':
            this.engine.endTurn();
            break;
          case 'build-road':
            this.engine.setBuildMode('road');
            break;
          case 'build-settlement':
            this.engine.setBuildMode('settlement');
            break;
          case 'build-city':
            this.engine.setBuildMode('city');
            break;
          case 'trade':
            this.tradeOpen = true;
            this.render();
            break;
          case 'close-trade':
            this.tradeOpen = false;
            this.render();
            break;
          case 'confirm-trade': {
            const give = (this.root.querySelector('#trade-give') as HTMLSelectElement).value as Resource;
            const receive = (this.root.querySelector('#trade-receive') as HTMLSelectElement).value as Resource;
            if (this.engine.bankTrade(give, receive)) {
              this.tradeOpen = false;
            }
            this.render();
            break;
          }
          case 'confirm-discard': {
            const pid = Number(el.dataset.player) as PlayerId;
            const draft = emptyBank();
            this.root.querySelectorAll<HTMLInputElement>('[data-res]').forEach((input) => {
              draft[input.dataset.res as Resource] = Number(input.value) || 0;
            });
            if (this.engine.discard(pid, draft)) {
              this.discardDraft = emptyBank();
            }
            break;
          }
          case 'steal': {
            const pid = Number(el.dataset.player) as PlayerId;
            this.engine.stealFrom(pid);
            break;
          }
          case 'restart':
            this.tradeOpen = false;
            this.engine.resetToLobby();
            this.lobby.classList.remove('hidden');
            this.renderLobby();
            this.root.innerHTML = '';
            break;
          case 'reset-view':
            this.onResetView?.();
            break;
          default:
            break;
        }
      });
    });

    void s;
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
