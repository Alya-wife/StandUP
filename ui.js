/**
 * Vanguard overDress UI Controller
 * Main Menu, Playmat 3-column stage, Left Battle Log & Chatroom,
 * Right Card Inspector (matching reference), clean full-art cards,
 * vertical damage stack, and complete Deck Builder.
 */

class VanguardUI {
    constructor() {
        this.engine = new VanguardEngine();
        this.network = new NetworkManager(this.engine,
            (peerId) => this.onPeerConnected(peerId),
            (data) => this.onNetworkAction(data)
        );

        this.selectedHandIndex = null;
        this.selectedMoveSourceCircle = null;
        this.selectedAttackerCircle = null;
        this.selectedBoosterCircle = null;
        this.selectedMulliganIndices = [];
        this.viewPerspective = 1;
        this.autoPov = true;
        this.triggerSelectionState = null;
        this.retireTargetSelectionState = null;

        // Card Admin State
        this.adminSelectedCardId = null;
        this.adminFilterNation = 'all';
        this.adminFilterCategory = 'all';
        this.adminFilterGrade = 'all';
        this.adminSearchTerm = '';

        // Deck Builder State
        this.editingDeck = null;
        this.selectedRideSlot = null;
        this.selectedP1DeckKey = null;
        this.selectedP2DeckKey = null;

        this.initDOM();
        this.bindMenuEvents();
        this.bindChatEvents();
        this.bindDeckBuilderEvents();
        this.bindEngineEvents();

        window.addEventListener('resize', () => {
            if (this.engine && this.engine.combat) {
                this.renderAttackArrow();
            }
        });
    }

    initDOM() {
        this.viewMainMenu = document.getElementById('viewMainMenu');
        this.viewGamePlay = document.getElementById('viewGameStage') || document.getElementById('viewGamePlay');
        this.viewDeckBuilder = document.getElementById('viewDeckBuilder');
        this.viewCardAdmin = document.getElementById('viewCardAdmin');

        this.elPhaseTracker = document.getElementById('phaseTrackBar') || document.getElementById('phaseTracker');
        this.elTurnIndicator = document.getElementById('turnOwnerBadge') || document.getElementById('turnIndicator');
        this.elActiveHand = document.getElementById('p1HandCardsContainer') || document.getElementById('activePlayerHand');
        this.elOppHand = document.getElementById('oppHandCardsContainer');
        this.elModal = document.getElementById('gameModal');
        this.elDeckSelectModal = document.getElementById('deckSelectModal');
        this.elTriggerSplash = document.getElementById('triggerSplash');
        this.elLogs = document.getElementById('battleLogContainer') || document.getElementById('logsContainer');

        const safeClick = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        };

        safeClick('btnBackToMenu', () => this.showView('viewMainMenu'));
        safeClick('btnAdminBackToMenu', () => this.showView('viewMainMenu'));
        safeClick('btnGoToAdminFromStage', () => {
            this.showView('viewCardAdmin');
            this.initCardAdminUI();
        });
        safeClick('btnGoToAdminFromDeck', () => {
            this.showView('viewCardAdmin');
            this.initCardAdminUI();
        });
        safeClick('btnActionPrimary', () => this.handleActionPhaseBtn());
        safeClick('btnActionPhase', () => this.handleActionPhaseBtn());
        safeClick('btnEndTurn', () => this.handleEndTurn());
        safeClick('btnToggleAutoPov', () => this.toggleAutoPov());
        safeClick('btnSwitchView', () => this.togglePerspective());
        safeClick('btnRestart', () => this.showTestRoomDeckSelectModal(true));
        safeClick('btnRestartMatch', () => this.showTestRoomDeckSelectModal(true));
        safeClick('p1_dropSlot', () => this.showDropZoneModal(1));
        safeClick('p2_dropSlot', () => this.showDropZoneModal(2));
    }

    showView(viewId) {
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        let target = document.getElementById(viewId);
        if (!target && viewId === 'viewGamePlay') target = document.getElementById('viewGameStage');
        if (target) target.classList.add('active');
        if (viewId === 'viewGameStage' || viewId === 'viewGamePlay') {
            document.body.classList.add('stage-active');
        } else {
            document.body.classList.remove('stage-active');
        }
    }

    bindMenuEvents() {
        const safeClick = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        };

        safeClick('menuBtnCreateRoom', () => this.showCreateRoomModal());
        safeClick('menuBtnEnterRoom', () => this.showEnterRoomModal());
        safeClick('menuBtnDeck', () => {
            this.showView('viewDeckBuilder');
            const mgr = document.getElementById('deckManagerView');
            const edt = document.getElementById('deckEditorView');
            if (mgr) mgr.style.display = 'flex';
            if (edt) edt.style.display = 'none';
            this.renderSavedDecksList();
        });
        safeClick('menuBtnTestRoom', () => {
            this.showTestRoomDeckSelectModal(false);
        });
        safeClick('menuBtnAdminCards', () => {
            this.showView('viewCardAdmin');
            this.initCardAdminUI();
        });
    }

    bindChatEvents() {
        const form = document.getElementById('chatForm');
        const input = document.getElementById('chatInput') || document.getElementById('inputChatMsg');
        const btnSend = document.getElementById('btnSendChat');

        const send = () => {
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;
            const sender = (this.engine && this.engine.activePlayer === 1) ? 'Player 1' : 'Player 2';
            const cls = (this.engine && this.engine.activePlayer === 1) ? 'p1' : 'p2';
            this.addChatMessage(sender, text, cls);
            if (this.network) this.network.sendAction('CHAT', { sender, text, cls });
            input.value = '';
        };

        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                send();
            };
        } else {
            if (btnSend) btnSend.onclick = send;
            if (input) input.onkeypress = (e) => { if (e.key === 'Enter') send(); };
        }
    }

    addChatMessage(sender, text, cls = '') {
        const list = document.getElementById('chatMessagesContainer') || document.getElementById('chatMessagesList');
        if (!list) return;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${cls}`;
        bubble.innerHTML = `<b>${sender}:</b> ${text}`;
        list.appendChild(bubble);
        list.scrollTop = list.scrollHeight;
    }

    bindEngineEvents() {
        this.engine.onUpdate((engine, eventType, payload) => {
            if (this.network && this.network.isOnline && this.network.isHost) {
                this.network.sendAction('SYNC_STATE', {
                    state: this.engine.getState(),
                    eventType: eventType,
                    payload: payload
                });
            }
            this.handleEngineEvent(eventType, payload);
        });
    }

    handleEngineEvent(eventType, payload = {}) {
        if (this.autoPov) {
            if (this.network && this.network.isOnline) {
                this.viewPerspective = this.network.myPlayerId;
            } else {
                if (eventType === 'TURN_STARTED' && payload && payload.playerNum) {
                    this.viewPerspective = payload.playerNum;
                } else if (eventType === 'ON_ATTACK_ABILITY_PROMPT') {
                    this.viewPerspective = this.engine.activePlayer;
                } else if (eventType === 'ATTACK_DECLARED') {
                    this.viewPerspective = this.engine.getOpponentPlayer().id;
                } else if (eventType === 'DRIVE_STEP_START' || eventType === 'BATTLE_CLOSED') {
                    this.viewPerspective = this.engine.activePlayer;
                }
            }
        }

        this.renderAll();

        if (eventType === 'INIT') {
            this.showDiceRollModal();
        } else if (eventType === 'MULLIGAN_START') {
            const pNum = (this.network && this.network.isOnline) ? this.network.myPlayerId : 1;
            this.showMulliganModal(pNum);
        } else if (eventType === 'STAND_UP') {
            this.showSplash("STAND UP, VANGUARD!", "gold");
        } else if (eventType === 'RIDE_PROMPT') {
            const p = this.engine.getActivePlayer();
            const currentGrade = p.circles.vc ? p.circles.vc.card.grade : -1;
            const canShow = (!this.network || !this.network.isOnline) || (this.engine.activePlayer === this.network.myPlayerId);
            if (currentGrade < 3 && canShow) {
                this.showRideDeckModal();
            }
        } else if (eventType === 'ON_ATTACK_ABILITY_PROMPT') {
            const canShow = (!this.network || !this.network.isOnline) || (this.engine.activePlayer === this.network.myPlayerId);
            if (canShow) {
                this.showOnAttackAbilityModal(payload);
            }
        } else if (eventType === 'TRIUMPH_AUTO_RESOLVED') {
            this.showFloatingBuffFX(payload.player.id, 'vc', '+5,000', 'power');
            setTimeout(() => this.showFloatingBuffFX(payload.player.id, 'vc', '+1 CRIT', 'crit'), 350);
        } else if (eventType === 'TRIUMPH_ACT_ACTIVATED') {
            this.showFloatingBuffFX(payload.player.id, 'vc', '+10,000', 'power');
        } else if (eventType === 'DRIVE_CHECK_REVEAL') {
            this.showDriveCheckReveal(payload);
        } else if (eventType === 'DAMAGE_CHECK_REVEAL') {
            this.showDamageCheckReveal(payload);
        } else if (eventType === 'CARD_DRAWN') {
            this.animateCardDraw(payload.player.id, payload.card);
        } else if (eventType === 'TRIGGER_RESOLVED') {
            this.showSplash(`${payload.trigger} TRIGGER!`, "pink");
        } else if (eventType === 'BATTLE_CLOSED' || eventType === 'END_PHASE') {
            const hud = document.getElementById('inGameCardRevealHud');
            if (hud) hud.style.display = 'none';
            if (this.revealTimer) {
                clearTimeout(this.revealTimer);
                this.revealTimer = null;
            }
            const arrowSvg = document.getElementById('combatAttackArrowSvg');
            if (arrowSvg) {
                arrowSvg.style.display = 'none';
                arrowSvg.innerHTML = '';
            }
        } else if (eventType === 'GAME_OVER') {
            this.showGameOverModal(payload.winner, payload.reason);
        } else if (eventType === 'LOG') {
            this.renderLogs();
        }
    }

    showTestRoomDeckSelectModal(isIngame = false) {
        const modal = this.elDeckSelectModal || document.getElementById('deckSelectModal');
        if (!modal) {
            this.showView('viewGameStage');
            this.startNewMatch();
            return;
        }

        const decks = (typeof getSavedDecks === 'function') ? getSavedDecks() : {};
        const deckKeys = Object.keys(decks);

        if (deckKeys.length === 0) {
            alert('Tidak ada deck yang tersimpan!');
            return;
        }

        // Default selections
        let p1Key = this.selectedP1DeckKey || ((typeof getActiveDeckId === 'function') ? getActiveDeckId() : 'varga_dragres');
        if (!decks[p1Key]) p1Key = deckKeys[0];

        let p2Key = this.selectedP2DeckKey || (decks['bastion_sanctuary'] ? 'bastion_sanctuary' : (deckKeys.length > 1 ? deckKeys[1] : deckKeys[0]));
        if (!decks[p2Key]) p2Key = deckKeys[0];

        modal.innerHTML = `
            <div class="modal-content deck-select-modal-box">
                <div class="modal-header-deck-select">
                    <h2 class="modal-title" style="font-size:22px;margin:0 0 6px 0;">PERSIAPAN MATCH TEST ROOM</h2>
                    <p style="color:#94a3b8;font-size:13px;margin:0;">Pilih deck untuk <b>Player 1</b> dan <b>Player 2</b> sebelum memulai pertarungan:</p>
                </div>

                <div class="deck-select-columns-grid">
                    <!-- Player 1 Column -->
                    <div class="deck-select-player-card p1-card">
                        <div class="deck-select-player-header p1-header">
                            <span class="p-dot p1-dot"></span>
                            <span class="p-title">PLAYER 1 (Giliran Bawah / POV Utama)</span>
                        </div>
                        <label class="deck-select-label">Pilih Deck:</label>
                        <select id="selectDeckP1" class="deck-picker-dropdown"></select>
                        <div id="previewDeckP1Container" class="deck-preview-slot"></div>
                    </div>

                    <!-- VS Divider -->
                    <div class="deck-select-vs-divider">
                        <div class="vs-circle">VS</div>
                    </div>

                    <!-- Player 2 Column -->
                    <div class="deck-select-player-card p2-card">
                        <div class="deck-select-player-header p2-header">
                            <span class="p-dot p2-dot"></span>
                            <span class="p-title">PLAYER 2 (Lawan / Giliran Atas)</span>
                        </div>
                        <label class="deck-select-label">Pilih Deck:</label>
                        <select id="selectDeckP2" class="deck-picker-dropdown"></select>
                        <div id="previewDeckP2Container" class="deck-preview-slot"></div>
                    </div>
                </div>

                <!-- Modal Actions -->
                <div class="deck-select-actions">
                    <button class="btn btn-primary btn-lg" id="btnStartMatchWithDecks" style="font-size:14px;font-weight:800;padding:10px 28px;">
                        Mulai Pertarungan
                    </button>
                    <button class="btn" id="btnCancelMatchDeckSelect" style="padding:10px 20px;">
                        ${isIngame ? 'Tutup' : 'Kembali ke Menu'}
                    </button>
                </div>
            </div>
        `;

        const selP1 = document.getElementById('selectDeckP1');
        const selP2 = document.getElementById('selectDeckP2');
        const p1PreviewContainer = document.getElementById('previewDeckP1Container');
        const p2PreviewContainer = document.getElementById('previewDeckP2Container');

        const populateOptions = (selectEl, selectedVal) => {
            selectEl.innerHTML = '';
            deckKeys.forEach(k => {
                const d = decks[k];
                const opt = document.createElement('option');
                opt.value = k;
                const count = d.mainDeckIds ? d.mainDeckIds.length : 0;
                opt.textContent = `${d.name} (${d.nation}) [${count} kartu]`;
                if (k === selectedVal) opt.selected = true;
                selectEl.appendChild(opt);
            });
        };

        populateOptions(selP1, p1Key);
        populateOptions(selP2, p2Key);

        const renderPreview = (deckKey, container) => {
            const d = decks[deckKey];
            if (!d || !container) return;

            let coverCard = null;
            if (d.rideDeckIds && d.rideDeckIds.length > 0) {
                const g3Id = d.rideDeckIds.find(id => {
                    const c = getCardById(id);
                    return c && c.grade === 3 && !c.isCrest;
                });
                if (g3Id) coverCard = getCardById(g3Id);
                if (!coverCard) {
                    const nonCrest = d.rideDeckIds.filter(id => {
                        const c = getCardById(id);
                        return c && !c.isCrest;
                    });
                    if (nonCrest.length > 0) coverCard = getCardById(nonCrest[nonCrest.length - 1]);
                }
            }
            if (!coverCard && d.mainDeckIds && d.mainDeckIds.length > 0) {
                coverCard = getCardById(d.mainDeckIds[0]);
            }
            const coverImg = (coverCard && coverCard.image) ? coverCard.image : 'img/Card/dztd01_002.webp';

            let trgCount = 0;
            (d.mainDeckIds || []).forEach(id => {
                const c = getCardById(id);
                if (c && c.trigger && c.trigger !== 'NONE') trgCount++;
            });

            const isCe = typeof isCrayElementalNation === 'function' && isCrayElementalNation(d.nation);

            container.innerHTML = `
                <div class="deck-select-preview-card">
                    <div class="deck-select-cover-wrap">
                        <img src="${coverImg}" class="deck-select-cover-img" alt="${d.name}">
                        <span class="deck-select-grade-badge">${coverCard ? `G${coverCard.grade}` : 'Deck'}</span>
                    </div>
                    <div class="deck-select-info">
                        <div class="deck-select-name">${d.name}</div>
                        <div class="deck-select-nation-badge">
                            <span class="badge-tag tag-type" ${isCe ? 'style="border-color:#10b981;color:#6ee7b7;"' : ''}>${d.nation}</span>
                            ${isCe ? '<span class="badge-tag" style="background:#10b981;color:#000;font-size:10px;padding:2px 6px;">Universal</span>' : ''}
                        </div>
                        <div class="deck-select-stats-list">
                            <span>Main Deck: <b>${(d.mainDeckIds || []).length}</b> / 50</span>
                            <span>⭐ Ride Deck: <b>${(d.rideDeckIds || []).length}</b> / 5</span>
                            <span>Triggers: <b>${trgCount}</b> / 16</span>
                        </div>
                    </div>
                </div>
            `;
        };

        renderPreview(selP1.value, p1PreviewContainer);
        renderPreview(selP2.value, p2PreviewContainer);

        selP1.onchange = () => renderPreview(selP1.value, p1PreviewContainer);
        selP2.onchange = () => renderPreview(selP2.value, p2PreviewContainer);

        const btnStart = document.getElementById('btnStartMatchWithDecks');
        if (btnStart) {
            btnStart.onclick = () => {
                const finalP1 = selP1.value;
                const finalP2 = selP2.value;
                modal.style.display = 'none';
                this.showView('viewGameStage');
                this.startNewMatch(finalP1, finalP2);
            };
        }

        const btnCancel = document.getElementById('btnCancelMatchDeckSelect');
        if (btnCancel) {
            btnCancel.onclick = () => {
                modal.style.display = 'none';
                if (!isIngame) {
                    this.showView('viewMainMenu');
                }
            };
        }

        modal.style.display = 'flex';
    }

    startNewMatch(p1DeckKey, p2DeckKey) {
        const activeDeck = p1DeckKey || this.selectedP1DeckKey || ((typeof getActiveDeckId === 'function') ? (getActiveDeckId() || 'varga_dragres') : 'varga_dragres');
        const opponentDeck = p2DeckKey || this.selectedP2DeckKey || 'bastion_sanctuary';
        this.selectedP1DeckKey = activeDeck;
        this.selectedP2DeckKey = opponentDeck;
        this.engine = new VanguardEngine(activeDeck, opponentDeck);
        this.viewPerspective = 1;
        this.bindEngineEvents();
        this.renderAll();
        if (this.engine.phase === 'DICE_ROLL') {
            this.showDiceRollModal();
        }
    }

    renderAll() {
        this.renderPhaseTracker();
        this.renderField(1);
        this.renderField(2);
        this.renderZones();
        this.renderGuardians();
        this.renderCombatBanner();
        this.renderHands();
        this.renderAttackArrow();
        this.renderLogs();
        this.updateActionButtons();

        // Auto-POV: Update mat board flip
        const matGrid = document.getElementById('matBoardGrid');
        if (matGrid) {
            if (this.viewPerspective === 2) {
                matGrid.classList.add('perspective-p2');
            } else {
                matGrid.classList.remove('perspective-p2');
            }
        }

        const btnSwitch = document.getElementById('btnSwitchView');
        if (btnSwitch) {
            btnSwitch.textContent = `POV: P${this.viewPerspective}`;
        }

        const btnAuto = document.getElementById('btnToggleAutoPov');
        if (btnAuto) {
            btnAuto.textContent = `Auto POV: ${this.autoPov ? 'ON' : 'OFF'}`;
            if (this.autoPov) btnAuto.classList.add('active');
            else btnAuto.classList.remove('active');
        }

        const oppHandLabel = document.getElementById('oppHandLabel');
        if (oppHandLabel) {
            const pOpp = this.viewPerspective === 1 ? this.engine.p2 : this.engine.p1;
            oppHandLabel.innerHTML = `OPPONENT HAND (P${pOpp.id}) (<span id="oppHandCount">${pOpp.hand.length}</span>)`;
        }

        // Safety cleanup: Ensure reveal HUD is never stuck outside of drive/damage checks
        const hud = document.getElementById('inGameCardRevealHud');
        if (hud && this.engine.phase !== 'DRIVE_STEP' && !this.engine.p1.triggerZone && !this.engine.p2.triggerZone) {
            hud.style.display = 'none';
        }
    }

    renderPhaseTracker() {
        const current = this.engine.phase;
        document.querySelectorAll('.phase-pill, .phase-item').forEach(el => {
            const pId = el.id ? el.id.replace('phase_', '') : (el.dataset.phase || '');
            if (current.includes(pId)) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        const activePlayer = this.engine.getActivePlayer();
        const indicator = this.elTurnIndicator || document.getElementById('turnOwnerBadge');
        if (indicator) {
            indicator.textContent = `Turn ${this.engine.turn} : ${activePlayer.name} (${activePlayer.nation})`;
        }
    }

    renderHands() {
        const pActive = this.viewPerspective === 1 ? this.engine.p1 : this.engine.p2;
        const pOpp = this.viewPerspective === 1 ? this.engine.p2 : this.engine.p1;

        // Player's Own Hand (Bottom Tray: Clean Full-Art Cards)
        const activeHandEl = this.elActiveHand || document.getElementById('p1HandCardsContainer');
        if (activeHandEl) {
            activeHandEl.innerHTML = '';
            const p1CountEl = document.getElementById('p1_handCount');
            if (p1CountEl) p1CountEl.textContent = pActive.hand.length;

            const totalHandCards = pActive.hand.length;
            const overlapMargin = totalHandCards > 7 ? Math.min(24, (totalHandCards - 7) * 4) : 0;

            pActive.hand.forEach((card, idx) => {
                const cardEl = this.createCardElement(card, false);
                if (idx > 0 && overlapMargin > 0) {
                    cardEl.style.marginLeft = `-${overlapMargin}px`;
                }

                // Persona Ride & Grade 4 Ride glow during Ride Phase (No text badges, glow only)
                if (this.engine.phase === 'RIDE_PHASE' && this.engine.activePlayer === pActive.id) {
                    const currentCard = pActive.circles.vc ? pActive.circles.vc.card : null;
                    if (currentCard && currentCard.grade === 3) {
                        const isPersona = (card.grade === 3 && card.name === currentCard.name && (typeof hasPersonaRide === 'function' ? hasPersonaRide(card) : true));
                        const isG4 = (card.grade === 4);
                        const isOtherG3 = (card.grade === 3 && !isPersona);

                        if (isPersona) {
                            cardEl.classList.add('persona-ride-ready');
                        } else if (isG4) {
                            cardEl.classList.add('g4-ride-ready');
                        } else if (isOtherG3) {
                            cardEl.classList.add('g3-ride-ready');
                        }
                    }
                }

                // Guard Step highlight for defending player (Shield glow + Badge)
                const isDefendingInGuardStep = (this.engine.phase === 'GUARD_STEP' && pActive.id === this.engine.getOpponentPlayer().id);
                if (isDefendingInGuardStep) {
                    const hasShield = (card.shield && card.shield > 0) || (card.skill && card.skill.includes('SENTINEL'));
                    if (hasShield) {
                        cardEl.classList.add('guard-card-available');
                        const shieldBadge = document.createElement('div');
                        shieldBadge.className = 'card-shield-badge';
                        shieldBadge.textContent = (card.skill && card.skill.includes('SENTINEL')) ? 'PG (Sentinel)' : `+${(card.shield || 0).toLocaleString()}`;
                        cardEl.appendChild(shieldBadge);
                    }
                }

                if (this.selectedHandIndex === idx && this.engine.activePlayer === pActive.id) {
                    cardEl.style.transform = 'translateY(-18px) scale(1.12)';
                    cardEl.style.boxShadow = '0 0 16px #06b6d4';
                }

                cardEl.onclick = () => this.onHandCardClick(pActive.id, idx);
                cardEl.onmouseenter = () => this.inspectCard(card);
                activeHandEl.appendChild(cardEl);
            });
        }

        // Opponent's Hand Bar (Top Tray: Card backs + Count)
        const oppHandEl = this.elOppHand || document.getElementById('oppHandCardsContainer');
        if (oppHandEl) {
            oppHandEl.innerHTML = '';
            const oppCountEl = document.getElementById('oppHandCount') || document.getElementById('p2_handCount');
            if (oppCountEl) oppCountEl.textContent = pOpp.hand.length;

            for (let i = 0; i < pOpp.hand.length; i++) {
                const backEl = document.createElement('div');
                backEl.className = 'opp-card-back';
                oppHandEl.appendChild(backEl);
            }
        }
    }

    renderField(playerNum) {
        const player = playerNum === 1 ? this.engine.p1 : this.engine.p2;
        const opp = playerNum === 1 ? this.engine.p2 : this.engine.p1;
        const prefix = `p${playerNum}_`;

        const circleKeys = ['vc', 'rc_fl', 'rc_fr', 'rc_bl', 'rc_bc', 'rc_br'];
        circleKeys.forEach(key => {
            const el = document.getElementById(`${prefix}${key}`);
            if (!el) return;

            el.innerHTML = '';
            const unit = player.circles[key];
            const isFrontRow = ['vc', 'rc_fl', 'rc_fr'].includes(key);
            const hasPersonaAura = player.personaRideActive && isFrontRow;

            if (unit) {
                const cardEl = this.createCardElement(unit.card, unit.faceDown, unit.isRest, unit.tempPower);
                cardEl.onmouseenter = () => this.inspectCard(unit.card);
                el.appendChild(cardEl);

                // Power Tag on Field (including active booster addition and persona ride aura)
                if (!unit.faceDown) {
                    const tag = document.createElement('div');
                    let totalPow = unit.card.power + (unit.tempPower || 0) + (hasPersonaAura ? 10000 : 0);
                    let isBoosted = (unit.tempPower || 0) > 0 || hasPersonaAura;

                    if (this.selectedAttackerCircle === key && this.selectedBoosterCircle && playerNum === this.engine.activePlayer) {
                        const bUnit = player.circles[this.selectedBoosterCircle];
                        if (bUnit) {
                            const bPow = bUnit.card.power + (bUnit.tempPower || 0);
                            totalPow += bPow;
                            isBoosted = true;
                            tag.textContent = `${totalPow} (+${bPow})`;
                        } else {
                            tag.textContent = totalPow;
                        }
                    } else {
                        tag.textContent = totalPow;
                    }

                    tag.className = `unit-power-tag ${isBoosted ? 'boosted' : ''}`;
                    el.appendChild(tag);
                }

                // Triumph Dragon [ACT] button on Vanguard during Main Phase
                if (key === 'vc' && this.engine.phase === 'MAIN_PHASE' && this.engine.activePlayer === playerNum) {
                    const isTriumph = unit.card.id === 'DZ-TD01/001' || unit.card.id === 'dz_002' || (unit.card.name && (unit.card.name.toLowerCase().includes('triumph') || unit.card.name.toLowerCase().includes('varga')));
                    if (isTriumph && !unit.actUsedThisTurn) {
                        const canPay = this.engine.canCounterBlast(player, 1);
                        const actBtn = document.createElement('button');
                        actBtn.className = `btn-act-trigger ${canPay ? 'ready' : 'disabled'}`;
                        actBtn.innerHTML = '[ACT] Cari & +10k';
                        actBtn.title = canPay ? 'Gunakan efek [ACT] Triumph Dragon (CB1)' : 'Perlu 1 Damage Face-Up untuk CB(1)';
                        actBtn.onclick = (e) => {
                            e.stopPropagation();
                            if (canPay) {
                                this.openTriumphActModal(player);
                            } else {
                                this.showSplash('Tidak cukup damage face-up untuk Counter-Blast 1!', 'red');
                            }
                        };
                        el.appendChild(actBtn);
                    }
                }

                // Intercept Tag during Guard Step for Defending Player
                if (this.engine.phase === 'GUARD_STEP' && playerNum === opp.id && (key === 'rc_fl' || key === 'rc_fr')) {
                    if (unit.card.grade === 2) {
                        const shieldTag = document.createElement('div');
                        shieldTag.className = 'unit-shield-tag';
                        shieldTag.textContent = '+5,000 Shield';
                        el.appendChild(shieldTag);
                    }
                }
            } else {
                if (key === 'vc') {
                    el.innerHTML = this.getVanguardCrestSVG();
                } else {
                    el.innerHTML = this.getRearguardCrestSVG();
                }
            }

            // Persona Ride Front-Row Aura (Glow & boosted power tag only, no text badge)
            if (hasPersonaAura) {
                el.classList.add('persona-front-row-aura');
            }

            el.classList.remove('targetable', 'selectable', 'attacker-selected', 'booster-selected', 'boost-available', 'attack-targetable', 'move-source-selected', 'move-target-available', 'trigger-target-selectable', 'crit-step', 'retire-target-selectable');

            // Triumph Dragon AUTO: Retire target selection highlight on opponent rear-guards
            if (this.retireTargetSelectionState && this.retireTargetSelectionState.active) {
                if (playerNum === opp.id && key.startsWith('rc_') && unit && !unit.faceDown) {
                    el.classList.add('retire-target-selectable');
                }
            }

            // Trigger target selectable highlight on field units
            if (this.triggerSelectionState && this.triggerSelectionState.active && playerNum === this.triggerSelectionState.payload.player.id) {
                if (unit && !unit.faceDown) {
                    el.classList.add('trigger-target-selectable');
                    if (this.triggerSelectionState.step === 'CRITICAL') {
                        el.classList.add('crit-step');
                    }
                }
            }
            
            const partnerMap = { 'rc_fl': 'rc_bl', 'rc_bl': 'rc_fl', 'rc_fr': 'rc_br', 'rc_br': 'rc_fr' };

            if (this.engine.phase === 'MAIN_PHASE' && this.engine.activePlayer === playerNum) {
                if (this.selectedHandIndex !== null) {
                    if (key.startsWith('rc_')) el.classList.add('selectable');
                } else {
                    // Rear-guard Column Movement / Swap highlight
                    if (this.selectedMoveSourceCircle === key) {
                        el.classList.add('move-source-selected');
                    } else if (this.selectedMoveSourceCircle && partnerMap[this.selectedMoveSourceCircle] === key) {
                        el.classList.add('move-target-available');
                        const hint = document.createElement('div');
                        hint.className = 'move-swap-hint';
                        hint.textContent = unit ? 'Tukar Posisi' : 'Pindah Baris';
                        el.appendChild(hint);
                    } else if (['rc_fl', 'rc_bl', 'rc_fr', 'rc_br'].includes(key) && unit) {
                        el.classList.add('selectable');
                    }
                }
            } else if (this.engine.phase === 'BATTLE_START' && this.engine.activePlayer === playerNum) {
                if (this.selectedAttackerCircle === key) {
                    el.classList.add('attacker-selected');
                } else if (this.selectedBoosterCircle === key) {
                    el.classList.add('booster-selected');
                } else if (['vc', 'rc_fl', 'rc_fr'].includes(key) && unit && !unit.isRest) {
                    el.classList.add('selectable');
                } else if (['rc_bl', 'rc_bc', 'rc_br'].includes(key) && unit && !unit.isRest && (unit.card.grade <= 1 || unit.card.skill.includes('BOOST'))) {
                    el.classList.add('boost-available');
                }
            } else if (this.selectedAttackerCircle && this.engine.phase === 'BATTLE_START' && this.engine.activePlayer !== playerNum) {
                if (['vc', 'rc_fl', 'rc_fr'].includes(key) && unit) {
                    el.classList.add('attack-targetable');
                }
            }

            el.onclick = () => this.onCircleClick(playerNum, key);
        });
    }

    renderZones() {
        [1, 2].forEach(pNum => {
            const p = pNum === 1 ? this.engine.p1 : this.engine.p2;
            const prefix = `p${pNum}_`;

            const deckEl = document.getElementById(`${prefix}deckCount`);
            if (deckEl) deckEl.textContent = `Deck: ${p.deck.length}`;

            const bindEl = document.getElementById(`${prefix}bindCount`);
            if (bindEl) bindEl.textContent = p.bind.length;

            const numEl = document.getElementById(`${prefix}damageNum`);
            if (numEl) numEl.textContent = p.damage.length;

            // Drop Zone preview & count
            const dropEmpty = document.getElementById(`${prefix}dropEmpty`);
            const dropCardCont = document.getElementById(`${prefix}dropCardContainer`);
            const dropTopImg = document.getElementById(`${prefix}dropTopImg`);
            const dropBadge = document.getElementById(`${prefix}dropBadge`);
            const dropSlot = document.getElementById(`${prefix}dropSlot`);

            if (p.drop.length > 0) {
                const topCard = p.drop[p.drop.length - 1];
                if (dropEmpty) dropEmpty.style.display = 'none';
                if (dropCardCont) dropCardCont.style.display = 'block';
                if (dropTopImg) dropTopImg.src = topCard.image || 'img/Card/dztd01_002.webp';
                if (dropBadge) dropBadge.textContent = p.drop.length;
                if (dropSlot) {
                    dropSlot.onmouseenter = () => this.inspectCard(topCard);
                }
            } else {
                if (dropEmpty) dropEmpty.style.display = 'flex';
                if (dropCardCont) dropCardCont.style.display = 'none';
                const dropEl = document.getElementById(`${prefix}dropCount`);
                if (dropEl) dropEl.textContent = '0';
            }

            // Damage Zone uncropped landscape stacking
            const stackEl = document.getElementById(`${prefix}damageStack`);
            if (stackEl) {
                stackEl.innerHTML = '';
                p.damage.forEach(card => {
                    const isFaceDown = !!card.faceDown;
                    const slotEl = document.createElement('div');
                    slotEl.className = `damage-card-slot ${isFaceDown ? 'damage-card-facedown' : ''}`;
                    slotEl.title = isFaceDown ? 'Damage (Face-Down / Counter-Blast Paid)' : `${card.name} (Trigger: ${card.trigger || 'None'})`;
                    slotEl.innerHTML = `
                        <div class="damage-card-inner">
                            ${isFaceDown 
                                ? `<div class="damage-facedown-card" style="width:100%;height:100%;background:linear-gradient(135deg, #0f172a, #1e293b);border:1.5px solid #475569;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9px;font-weight:900;border-radius:4px;letter-spacing:0.5px;box-shadow:inset 0 0 8px rgba(0,0,0,0.8);">CB</div>` 
                                : `<img src="${card.image || 'img/Card/dztd01_002.webp'}" class="damage-card-rotated-img" alt="${card.name}">`
                            }
                        </div>
                    `;
                    if (!isFaceDown) slotEl.onmouseenter = () => this.inspectCard(card);
                    stackEl.appendChild(slotEl);
                });
            }
        });
    }

    renderGuardians() {
        const gcStack = document.getElementById('gcGuardiansStack');
        const gcSvg = document.getElementById('circleGCSvg');
        if (!gcStack) return;

        if (this.engine.combat && this.engine.combat.guardians && this.engine.combat.guardians.length > 0) {
            gcStack.style.display = 'flex';
            gcStack.innerHTML = '';
            this.engine.combat.guardians.forEach(card => {
                const img = document.createElement('img');
                img.className = 'gc-guard-card-thumb';
                img.src = card.image || 'img/Card/dztd01_002.webp';
                img.alt = card.name;
                img.title = `${card.name} (+${card.shield} Shield)`;
                img.onmouseenter = () => this.inspectCard(card);
                gcStack.appendChild(img);
            });
            if (gcSvg) gcSvg.style.opacity = '0.2';
        } else {
            gcStack.style.display = 'none';
            if (gcSvg) gcSvg.style.opacity = '1';
        }
    }

    renderCombatBanner() {
        const banner = document.getElementById('combatGuardBanner');
        if (!banner) return;

        if (this.engine.phase === 'GUARD_STEP' && this.engine.combat) {
            banner.style.display = 'flex';
            const stats = this.engine.getCombatGuardStats();
            if (!stats) return;

            const atk = this.engine.combat.attackerUnit.card;
            const def = this.engine.combat.targetUnit.card;
            const opp = this.engine.getOpponentPlayer();
            const activeP = this.engine.getActivePlayer();
            const guardians = this.engine.combat.guardians || [];

            // Mini thumbnails of guardians in Guardian Circle
            let guardiansHtml = '';
            if (guardians.length > 0) {
                guardiansHtml = `
                    <div class="guardians-list-row" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0;justify-content:center;">
                        <span style="font-size:10px;font-weight:800;color:#94a3b8;">Guardians (${guardians.length}):</span>
                        ${guardians.map(g => `
                            <div class="guardian-mini-item" title="${g.name} (+${g.shield || 0})">
                                <img src="${g.image || 'img/Card/dztd01_002.webp'}" alt="${g.name}">
                                <span>${g.skill && g.skill.includes('SENTINEL') ? 'PG' : '+' + (g.shield || 0).toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            banner.innerHTML = `
                <div class="combat-guard-status">
                    <span class="combat-atk-tag">ATK: [${activeP.name}] ${atk.name} (${stats.atkPower.toLocaleString()})</span>
                    <span class="combat-vs-tag">VS</span>
                    <span class="combat-def-tag">DEF: [${opp.name}] ${def.name} (${stats.totalDefPower.toLocaleString()})</span>
                    <span class="pass-badge ${stats.passClass}">${stats.passLabel}</span>
                    <span style="color:#94a3b8;font-size:10px;">(Shield: <b style="color:#10b981;">+${stats.totalShield.toLocaleString()}</b>)</span>
                </div>
                <div class="combat-guard-actions">
                    <button class="btn btn-red" id="btnCombatNoGuard" style="padding:2px 8px;font-size:10px;">No Guard</button>
                    <button class="btn btn-emerald" id="btnCombatFinishGuard" style="padding:2px 8px;font-size:10px;">Selesai Guard</button>
                </div>
            `;

            const btnNo = document.getElementById('btnCombatNoGuard');
            if (btnNo) btnNo.onclick = () => this.engine.finishGuardStep();
            const btnFin = document.getElementById('btnCombatFinishGuard');
            if (btnFin) btnFin.onclick = () => this.engine.finishGuardStep();
        } else {
            banner.style.display = 'none';
        }
    }

    renderAttackArrow() {
        const svg = document.getElementById('combatAttackArrowSvg');
        if (!svg) return;

        if (!this.engine || !this.engine.combat || !['ATTACK_EFFECT_STEP', 'GUARD_STEP', 'DRIVE_STEP'].includes(this.engine.phase)) {
            svg.style.display = 'none';
            svg.innerHTML = '';
            return;
        }

        const matGrid = document.getElementById('matBoardGrid');
        if (!matGrid) return;

        const atkPlayerNum = this.engine.activePlayer;
        const defPlayerNum = this.engine.getOpponentPlayer().id;
        const atkKey = this.engine.combat.attackerCircleKey;
        const defKey = this.engine.combat.targetCircleKey;

        if (!atkKey || !defKey) {
            svg.style.display = 'none';
            svg.innerHTML = '';
            return;
        }

        const atkEl = document.getElementById(`p${atkPlayerNum}_${atkKey}`);
        const defEl = document.getElementById(`p${defPlayerNum}_${defKey}`);

        if (!atkEl || !defEl) {
            svg.style.display = 'none';
            svg.innerHTML = '';
            return;
        }

        const matRect = matGrid.getBoundingClientRect();
        const atkRect = atkEl.getBoundingClientRect();
        const defRect = defEl.getBoundingClientRect();

        const x1 = atkRect.left + atkRect.width / 2 - matRect.left;
        const y1 = atkRect.top + atkRect.height / 2 - matRect.top;
        const x2 = defRect.left + defRect.width / 2 - matRect.left;
        const y2 = defRect.top + defRect.height / 2 - matRect.top;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);

        // Arrow stops in front of the target card so it never overlaps or covers the card art
        const offsetStart = 32;
        const offsetEnd = 48;
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : 0;

        const sx = x1 + nx * offsetStart;
        const sy = y1 + ny * offsetStart;
        const ex = dist > offsetEnd ? x2 - nx * offsetEnd : x2;
        const ey = dist > offsetEnd ? y2 - ny * offsetEnd : y2;

        svg.style.display = 'block';
        svg.innerHTML = `
            <defs>
                <linearGradient id="attackArrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f59e0b"/>
                    <stop offset="100%" stop-color="#ef4444"/>
                </linearGradient>
                <filter id="arrowGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <marker id="attackArrowHead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M 0 1.5 L 6 4 L 0 6.5 z" fill="#ef4444" />
                </marker>
            </defs>
            <!-- Sleek Trail Line -->
            <line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="url(#attackArrowGrad)" stroke-width="2.5" stroke-dasharray="6 3" marker-end="url(#attackArrowHead)" filter="url(#arrowGlow)">
                <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.5s" repeatCount="indefinite" />
            </line>
            <!-- Sleek Origin Dot on Attacker -->
            <circle cx="${sx}" cy="${sy}" r="4" fill="#f59e0b" filter="url(#arrowGlow)" />
        `;
    }

    showFloatingBuffFX(playerNum, circleKey, text, type = 'power') {
        const el = document.getElementById(`p${playerNum}_${circleKey}`);
        if (!el) return;
        const fx = document.createElement('div');
        fx.className = `floating-buff-fx ${type}`;
        fx.textContent = text;
        el.appendChild(fx);
        setTimeout(() => {
            if (fx.parentNode) fx.parentNode.removeChild(fx);
        }, 1400);
    }

    showTriggerPromptPill(html) {
        let pill = document.getElementById('triggerPromptPill');
        if (!pill) {
            pill = document.createElement('div');
            pill.id = 'triggerPromptPill';
            pill.className = 'trigger-prompt-pill';
            const mat = document.getElementById('matBoardGrid');
            if (mat) mat.appendChild(pill);
        }
        pill.innerHTML = html;
        pill.style.display = 'flex';
    }

    hideTriggerPromptPill() {
        const pill = document.getElementById('triggerPromptPill');
        if (pill) pill.style.display = 'none';
    }

    animateCardDraw(playerNum, card) {
        if (typeof window === 'undefined' || !document.body) return;

        const deckCountEl = document.getElementById(`p${playerNum}_deckCount`);
        const deckBox = deckCountEl ? deckCountEl.closest('.deck-slot-box') : null;
        const handCont = playerNum === 1 ? document.getElementById('p1HandCardsContainer') : document.getElementById('oppHandCardsContainer');

        if (!deckBox || !handCont) return;

        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const deckRect = deckBox.getBoundingClientRect();
        const handRect = handCont.getBoundingClientRect();

        const startX = deckRect.left + (deckRect.width / 2) - 29;
        const startY = deckRect.top + (deckRect.height / 2) - 42;

        const targetX = handRect.width > 120 
            ? (handRect.left + Math.min(handRect.width - 60, Math.max(20, handRect.width * 0.75)))
            : (handRect.left + (handRect.width / 2) - 29);
        const targetY = handRect.top + (handRect.height / 2) - 42;

        const flyer = document.createElement('div');
        flyer.className = 'card-draw-ghost-flyer';
        flyer.innerHTML = `
            <div class="ghost-card-inner">
                <div class="vg-deck-back">VG</div>
            </div>
        `;

        document.body.appendChild(flyer);

        if (prefersReducedMotion) {
            flyer.remove();
            return;
        }

        const animation = flyer.animate([
            {
                transform: `translate3d(${startX}px, ${startY}px, 0) scale(0.92) rotate(4deg)`,
                opacity: 0.95
            },
            {
                transform: `translate3d(${targetX}px, ${targetY}px, 0) scale(1) rotate(0deg)`,
                opacity: 1
            }
        ], {
            duration: 240,
            easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
            fill: 'forwards'
        });

        const cleanup = () => {
            if (flyer.parentNode) flyer.parentNode.removeChild(flyer);
            if (handCont) {
                handCont.classList.add('hand-draw-pulse');
                setTimeout(() => handCont.classList.remove('hand-draw-pulse'), 180);
            }
        };

        animation.onfinish = cleanup;
        setTimeout(cleanup, 280);
    }

    showChooseCounterBlastModal(player, amount, onPaid, onCancel = null) {
        const faceUpCards = this.engine.getFaceUpDamageCards(player);
        if (faceUpCards.length < amount) {
            this.showSplash(`Damage face-up tidak cukup untuk Counter-Blast (${amount})!`, 'red');
            if (onCancel) onCancel();
            return;
        }

        const selectedIndices = [];

        const renderCbModalContent = () => {
            this.elModal.innerHTML = `
                <div class="modal-content" style="max-width:540px;text-align:center;">
                    <div class="modal-title" style="color:#ef4444;">Bayar Biaya: Counter-Blast (${amount})</div>
                    <p style="font-size:12px;color:#cbd5e1;margin-bottom:12px;">
                        Pilih <b>${amount}</b> kartu face-up di Damage Zone untuk dibalik (face-down):
                    </p>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;max-height:240px;overflow-y:auto;padding:10px;background:rgba(0,0,0,0.4);border-radius:8px;margin-bottom:16px;">
                        ${faceUpCards.map(item => {
                            const isSelected = selectedIndices.includes(item.damageIndex);
                            return `
                                <div class="cb-pick-card-item ${isSelected ? 'selected' : ''}" data-dmg-idx="${item.damageIndex}"
                                    style="cursor:pointer;border:${isSelected ? '2.5px solid #ef4444' : '1.5px solid rgba(255,255,255,0.2)'};border-radius:6px;overflow:hidden;width:82px;position:relative;box-shadow:${isSelected ? '0 0 14px rgba(239,68,68,0.85)' : '0 2px 6px rgba(0,0,0,0.5)'};transform:${isSelected ? 'scale(1.05)' : 'scale(1)'};transition:all 0.15s ease;">
                                    <img src="${item.card.image || 'img/Card/dztd01_002.webp'}" style="width:100%;height:115px;object-fit:cover;display:block;">
                                    <div style="background:${isSelected ? '#ef4444' : '#0f172a'};color:#fff;font-size:8.5px;font-weight:800;padding:3px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                        ${isSelected ? 'PILIH' : item.card.name}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="display:flex;gap:10px;justify-content:center;">
                        <button class="btn btn-red" id="btnConfirmPayCB" ${selectedIndices.length !== amount ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                            Bayar CB (${selectedIndices.length}/${amount})
                        </button>
                        <button class="btn btn-secondary" id="btnCancelPayCB">Batal</button>
                    </div>
                </div>
            `;
            this.elModal.style.display = 'flex';

            document.querySelectorAll('.cb-pick-card-item').forEach(el => {
                el.onclick = () => {
                    const idx = parseInt(el.getAttribute('data-dmg-idx'), 10);
                    const pos = selectedIndices.indexOf(idx);
                    if (pos !== -1) {
                        selectedIndices.splice(pos, 1);
                    } else {
                        if (amount === 1) {
                            selectedIndices.length = 0;
                            selectedIndices.push(idx);
                        } else if (selectedIndices.length < amount) {
                            selectedIndices.push(idx);
                        }
                    }
                    renderCbModalContent();
                };
            });

            const btnConfirm = document.getElementById('btnConfirmPayCB');
            if (btnConfirm && selectedIndices.length === amount) {
                btnConfirm.onclick = () => {
                    this.elModal.style.display = 'none';
                    if (onPaid) onPaid(amount === 1 ? selectedIndices[0] : selectedIndices);
                };
            }

            const btnCancel = document.getElementById('btnCancelPayCB');
            if (btnCancel) {
                btnCancel.onclick = () => {
                    this.elModal.style.display = 'none';
                    if (onCancel) onCancel();
                };
            }
        };

        renderCbModalContent();
    }

    showChooseSoulBlastModal(player, amount, onPaid, onCancel = null) {
        const soulCards = this.engine.getSoulCards(player);
        if (soulCards.length < amount) {
            this.showSplash(`Kartu di Soul tidak cukup untuk Soul-Blast (${amount})!`, 'red');
            if (onCancel) onCancel();
            return;
        }

        const selectedIndices = [];

        const renderSbModalContent = () => {
            this.elModal.innerHTML = `
                <div class="modal-content" style="max-width:540px;text-align:center;">
                    <div class="modal-title" style="color:#a855f7;">Bayar Biaya: Soul-Blast (${amount})</div>
                    <p style="font-size:12px;color:#cbd5e1;margin-bottom:12px;">
                        Pilih <b>${amount}</b> kartu dari Soul untuk dikirim ke Drop Zone (${player.name}):
                    </p>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;max-height:240px;overflow-y:auto;padding:10px;background:rgba(0,0,0,0.4);border-radius:8px;margin-bottom:16px;">
                        ${soulCards.map(item => {
                            const isSelected = selectedIndices.includes(item.soulIndex);
                            return `
                                <div class="sb-pick-card-item ${isSelected ? 'selected' : ''}" data-soul-idx="${item.soulIndex}"
                                    style="cursor:pointer;border:${isSelected ? '2.5px solid #a855f7' : '1.5px solid rgba(255,255,255,0.2)'};border-radius:6px;overflow:hidden;width:82px;position:relative;box-shadow:${isSelected ? '0 0 14px rgba(168,85,247,0.85)' : '0 2px 6px rgba(0,0,0,0.5)'};transform:${isSelected ? 'scale(1.05)' : 'scale(1)'};transition:all 0.15s ease;">
                                    <img src="${item.card.image || 'img/Card/dztd01_002.webp'}" style="width:100%;height:115px;object-fit:cover;display:block;">
                                    <div style="background:${isSelected ? '#a855f7' : '#0f172a'};color:#fff;font-size:8.5px;font-weight:800;padding:3px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                        ${isSelected ? 'PILIH' : item.card.name}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="display:flex;gap:10px;justify-content:center;">
                        <button class="btn btn-purple" id="btnConfirmPaySB" ${selectedIndices.length !== amount ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                            Bayar SB (${selectedIndices.length}/${amount})
                        </button>
                        <button class="btn btn-secondary" id="btnCancelPaySB">Batal</button>
                    </div>
                </div>
            `;
            this.elModal.style.display = 'flex';

            document.querySelectorAll('.sb-pick-card-item').forEach(el => {
                el.onclick = () => {
                    const idx = parseInt(el.getAttribute('data-soul-idx'), 10);
                    const pos = selectedIndices.indexOf(idx);
                    if (pos !== -1) {
                        selectedIndices.splice(pos, 1);
                    } else {
                        if (amount === 1) {
                            selectedIndices.length = 0;
                            selectedIndices.push(idx);
                        } else if (selectedIndices.length < amount) {
                            selectedIndices.push(idx);
                        }
                    }
                    renderSbModalContent();
                };
            });

            const btnConfirm = document.getElementById('btnConfirmPaySB');
            if (btnConfirm && selectedIndices.length === amount) {
                btnConfirm.onclick = () => {
                    this.elModal.style.display = 'none';
                    const indices = Array.isArray(selectedIndices) ? selectedIndices : [selectedIndices];
                    this.engine.paySoulBlastSpecific(player, indices);
                    this.renderAll();
                    if (onPaid) onPaid(indices);
                };
            }

            const btnCancel = document.getElementById('btnCancelPaySB');
            if (btnCancel) {
                btnCancel.onclick = () => {
                    this.elModal.style.display = 'none';
                    if (onCancel) onCancel();
                };
            }
        };

        renderSbModalContent();
    }

    openTriumphActModal(player, chosenDamageIndex = null) {
        const cb1Available = this.engine.canCounterBlast(player, 1);
        if (!cb1Available) {
            this.showSplash("Tidak cukup damage face-up untuk Counter-Blast 1!", "red");
            return;
        }

        if (chosenDamageIndex === null) {
            this.showChooseCounterBlastModal(player, 1, (chosenDmgIdx) => {
                this.openTriumphActModal(player, chosenDmgIdx);
            });
            return;
        }

        const copies = this.engine.getTriumphDeckCopies(player);

        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:540px;text-align:center;">
                <div class="modal-title" style="color:#f59e0b;">[ACT] Roaring Thunder Dragon, Triumph Dragon</div>
                <p style="font-size:12px;color:#cbd5e1;margin-bottom:12px;line-height:1.5;">
                    <b>[COST][Counter-Blast 1]</b>: Kartu Damage terpilih dibalik face-down.<br>
                    Cari hingga 1 kartu dengan nama yang sama dari deck, masukkan ke tangan, lalu kocok deck.<br>
                    Unit ini mendapatkan <b style="color:#fef08a;">[Power] +10,000</b> sampai akhir giliran!
                </p>
                
                <div style="font-size:11.5px;font-weight:700;color:#38bdf8;margin-bottom:8px;">
                    Ditemukan di Deck (${copies.length} kartu):
                </div>

                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;max-height:220px;overflow-y:auto;padding:8px;background:rgba(0,0,0,0.4);border-radius:8px;margin-bottom:16px;">
                    ${copies.length === 0 ? '<div style="color:#94a3b8;font-size:12px;padding:20px;">Tidak ada salinan kartu dengan nama yang sama di deck.</div>' : ''}
                    ${copies.map((c, i) => `
                        <div class="triumph-pick-item" data-deck-idx="${c.deckIndex}" style="cursor:pointer;border:2px solid #38bdf8;border-radius:6px;overflow:hidden;width:80px;box-shadow:0 4px 10px rgba(0,0,0,0.6);transition:transform 0.15s ease;" title="${c.card.name}">
                            <img src="${c.card.image || 'img/Card/dztd01_002.webp'}" style="width:100%;height:115px;object-fit:cover;display:block;">
                            <div style="background:#0f172a;color:#fff;font-size:8.5px;font-weight:700;padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Pilih #${i+1}</div>
                        </div>
                    `).join('')}
                </div>

                <div style="display:flex;gap:12px;justify-content:center;">
                    ${copies.length === 0 ? '<button class="btn btn-primary" id="btnTriumphActNoSearch" style="padding:8px 18px;">Lanjutkan (+10k Power)</button>' : ''}
                    <button class="btn btn-red" id="btnCancelTriumphAct" style="padding:8px 18px;">Batal</button>
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        document.querySelectorAll('.triumph-pick-item').forEach(el => {
            el.onmouseenter = () => { el.style.transform = 'scale(1.08)'; el.style.borderColor = '#f59e0b'; };
            el.onmouseleave = () => { el.style.transform = 'scale(1)'; el.style.borderColor = '#38bdf8'; };
            el.onclick = () => {
                const dIdx = parseInt(el.getAttribute('data-deck-idx'), 10);
                this.elModal.style.display = 'none';
                if (!this.dispatchAction('TRIUMPH_ACT', { targetCardId: dIdx, chosenDamageIndex })) {
                    this.engine.executeTriumphAct(player, dIdx, chosenDamageIndex);
                }
                this.renderAll();
            };
        });

        const btnNoSearch = document.getElementById('btnTriumphActNoSearch');
        if (btnNoSearch) {
            btnNoSearch.onclick = () => {
                this.elModal.style.display = 'none';
                if (!this.dispatchAction('TRIUMPH_ACT', { targetCardId: null, chosenDamageIndex })) {
                    this.engine.executeTriumphAct(player, null, chosenDamageIndex);
                }
                this.renderAll();
            };
        }

        const btnCancel = document.getElementById('btnCancelTriumphAct');
        if (btnCancel) {
            btnCancel.onclick = () => {
                this.elModal.style.display = 'none';
            };
        }
    }

    showOnAttackAbilityModal(payload) {
        const opp = this.engine.getOpponentPlayer();
        const oppRgKeys = ['rc_fl', 'rc_fr', 'rc_bl', 'rc_bc', 'rc_br'].filter(k => opp.circles[k] && !opp.circles[k].faceDown);

        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:480px;text-align:center;">
                <div class="modal-title" style="color:#f59e0b;">[AUTO] Roaring Thunder Dragon, Triumph Dragon</div>
                <div style="margin:12px auto;width:100px;height:145px;border-radius:8px;overflow:hidden;border:2px solid #ef4444;box-shadow:0 0 16px rgba(239,68,68,0.5);">
                    <img src="${payload.card.image || 'img/Card/dztd01_002.webp'}" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <div style="font-size:12.5px;color:#cbd5e1;line-height:1.5;margin-bottom:16px;">
                    <b>When this unit attacks a vanguard</b><br>
                    <b>[COST][Energy-Blast 4]</b>: Bayar 4 Energy Counter (Sisa: ${payload.player.energy}/10).<br>
                    Pilih 1 Rear-Guard lawan untuk di-<span style="color:#ef4444;font-weight:800;">Retire</span>, dan unit ini mendapatkan <span style="color:#fef08a;font-weight:800;">[Power] +5000</span> / <span style="color:#f472b6;font-weight:800;">[Critical] +1</span> sampai akhir battle!
                </div>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button class="btn btn-primary" id="btnActivateTriumphAuto" style="font-weight:800;padding:8px 22px;">
                        Aktifkan (EB4 & Retire)
                    </button>
                    <button class="btn btn-red" id="btnSkipTriumphAuto" style="padding:8px 18px;">
                        Lewati (Guard Step)
                    </button>
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        document.getElementById('btnActivateTriumphAuto').onclick = () => {
            this.elModal.style.display = 'none';
            if (oppRgKeys.length > 0) {
                this.retireTargetSelectionState = { active: true, player: payload.player };
                this.showSplash("PILIH 1 REAR-GUARD LAWAN UNTUK DI-RETIRE!", "red");
                this.renderAll();
            } else {
                if (!this.dispatchAction('TRIUMPH_AUTO', { retireCircleKey: null })) {
                    this.engine.activateTriumphAuto(null);
                }
                this.renderAll();
            }
        };

        document.getElementById('btnSkipTriumphAuto').onclick = () => {
            this.elModal.style.display = 'none';
            if (!this.dispatchAction('SKIP_ATTACK_ABILITY')) {
                this.engine.skipAttackAbility();
            }
            this.renderAll();
        };
    }

    renderLogs() {
        this.elLogs.innerHTML = '';
        this.engine.logs.forEach(item => {
            const row = document.createElement('div');
            row.className = `log-entry ${item.type}`;
            row.innerHTML = `<span style="opacity:0.6;font-size:9.5px;">[${item.time}]</span> ${item.msg}`;
            this.elLogs.appendChild(row);
        });
        this.elLogs.scrollTop = this.elLogs.scrollHeight;
    }

    // =========================================================
    // CARD DETAIL INSPECTOR (MATCHING REFERENCE IMAGE #2)
    // =========================================================
    inspectCard(card) {
        if (!card) return;
        const img = document.getElementById('inspectorCardArt');
        if (img) img.src = card.image || 'img/Card/dztd01_002.webp';

        const nameEl = document.getElementById('inspectorCardName');
        if (nameEl) nameEl.textContent = card.name;

        const metaEl = document.getElementById('inspectorCardType') || document.getElementById('inspectorCardMeta');
        if (metaEl) {
            const cat = getCardCategory(card);
            const isUniversal = typeof isCrayElementalNation === 'function' && isCrayElementalNation(card.nation);
            metaEl.innerHTML = `<span class="badge-tag tag-type" ${isUniversal ? 'style="border-color:#10b981;color:#6ee7b7;background:rgba(16,185,129,0.15);"' : ''}>[${cat}] ${card.nation}${isUniversal ? ' Universal' : ''}</span>`;
        }

        const gradeEl = document.getElementById('inspectorCardGrade');
        if (gradeEl) gradeEl.textContent = card.isCrest ? 'Crest' : `Grade ${card.grade}`;

        const powEl = document.getElementById('inspectorCardPower');
        if (powEl) powEl.textContent = `Power ${(card.power || card.basePower || 0).toLocaleString()}`;

        const critEl = document.getElementById('inspectorCardCrit');
        if (critEl) critEl.textContent = `Crit ${card.critical || card.baseCritical || 1}`;

        const shieldEl = document.getElementById('inspectorCardShield');
        if (shieldEl) {
            shieldEl.textContent = (card.shield || card.baseShield) ? `Shield: +${(card.shield || card.baseShield).toLocaleString()}` : 'Shield: -';
        }

        const abilityEl = document.getElementById('inspectorCardAbilities') || document.getElementById('inspectorCardAbility');
        if (abilityEl) {
            abilityEl.innerHTML = this.formatAbilityText(card.ability || 'No special rules effect.');
        }
    }

    formatAbilityText(rawText) {
        if (!rawText) return '<div class="ability-card-text">No special rules effect.</div>';
        let formatted = String(rawText)
            .replace(/\[ACT\]/g, '<span class="ability-tag act" style="background:#dc2626;color:#fff;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;">[ACT]</span>')
            .replace(/\[AUTO\]/g, '<span class="ability-tag auto" style="background:#2563eb;color:#fff;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;">[AUTO]</span>')
            .replace(/\[CONT\]/g, '<span class="ability-tag cont" style="background:#059669;color:#fff;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;">[CONT]</span>')
            .replace(/\[1\/Turn\]/g, '<span class="ability-tag once" style="background:#d97706;color:#fff;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;">[1/Turn]</span>')
            .replace(/\((VC|RC|GC)\)/g, '<span class="ability-tag zone" style="background:#475569;color:#e2e8f0;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;">($1)</span>');
        return `<div class="ability-card-text" style="font-size:11px;line-height:1.4;color:#cbd5e1;">${formatted}</div>`;
    }

    updateActionButtons() {
        const btnAction = document.getElementById('btnActionPrimary') || document.getElementById('btnActionPhase');
        if (!btnAction) return;
        if (this.engine.phase === 'RIDE_PHASE') {
            btnAction.style.display = 'inline-flex';
            const activeP = this.engine.getActivePlayer();
            const currentGrade = activeP.circles.vc ? activeP.circles.vc.card.grade : -1;
            if (currentGrade >= 3) {
                btnAction.textContent = 'Lewati Ride (Ke Main Phase) ->';
                btnAction.className = 'btn btn-cyan';
            } else {
                btnAction.textContent = 'Ride from Ride Deck';
                btnAction.className = 'btn btn-primary';
            }
        } else if (this.engine.phase === 'MAIN_PHASE') {
            btnAction.style.display = 'inline-flex';
            btnAction.textContent = this.engine.turn === 1 ? 'End Main Phase' : 'Proceed to Battle Phase';
            btnAction.className = 'btn btn-cyan';
        } else if (this.engine.phase === 'GUARD_STEP') {
            btnAction.style.display = 'inline-flex';
            btnAction.textContent = 'Pass / Finish Guard';
            btnAction.className = 'btn btn-primary';
        } else {
            btnAction.style.display = 'none';
        }
    }

    // Clean Full-Art Card Element
    createCardElement(card, isFaceDown = false, isRest = false, tempPower = 0) {
        const el = document.createElement('div');
        el.className = `vg-card ${isFaceDown ? 'face-down' : ''} ${isRest ? 'rested' : ''}`;

        if (!isFaceDown) {
            if (card.image) {
                const img = document.createElement('img');
                img.className = 'card-full-art';
                img.src = card.image;
                img.alt = card.name;
                el.appendChild(img);
            } else {
                el.innerHTML = `
                    <div style="font-size:8px;font-weight:900;color:#f59e0b;">G${card.grade}</div>
                    <div style="font-size:7.5px;font-weight:700;text-align:center;color:#fff;">${card.name}</div>
                    <div style="font-size:7.5px;color:#38bdf8;">${card.power}</div>
                `;
            }
        }
        return el;
    }

    onHandCardClick(playerNum, handIndex) {
        if (this.engine.phase === 'GUARD_STEP') {
            if (playerNum === this.engine.getOpponentPlayer().id) {
                if (!this.dispatchAction('CALL_GUARDIAN', { handIndex })) {
                    this.engine.callGuardian(handIndex);
                }
            }
            return;
        }

        if (this.network && this.network.isOnline && this.engine.activePlayer !== this.network.myPlayerId) {
            return; // Bukan giliran Anda dalam online match
        }

        if (playerNum !== this.engine.activePlayer) return;

        if (this.engine.phase === 'MAIN_PHASE') {
            this.selectedHandIndex = (this.selectedHandIndex === handIndex) ? null : handIndex;
            this.renderAll();
        } else if (this.engine.phase === 'RIDE_PHASE') {
            this.promptRideConfirmation(playerNum, handIndex);
        }
    }

    promptRideConfirmation(playerNum, handIndex) {
        const p = this.engine.getActivePlayer();
        const rideCard = p.hand[handIndex];
        if (!rideCard) return;

        const currentCard = p.circles.vc ? p.circles.vc.card : null;
        const currentGrade = currentCard ? currentCard.grade : 0;

        if (rideCard.grade !== currentGrade && rideCard.grade !== currentGrade + 1) {
            this.showSplash(`Grade kartu ini (G${rideCard.grade}) tidak sesuai untuk di-ride ke Vanguard (G${currentGrade})!`, "cyan");
            return;
        }

        const isPersona = (currentGrade === 3 && rideCard.grade === 3 && currentCard && rideCard.name === currentCard.name && (typeof hasPersonaRide === 'function' ? hasPersonaRide(rideCard) : true));
        const isG4 = (currentGrade === 3 && rideCard.grade === 4);

        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:440px;text-align:center;">
                <div class="modal-title">${isPersona ? 'Konfirmasi Persona Ride' : 'Konfirmasi Ride'}</div>
                <div style="margin:14px auto;width:115px;height:165px;border-radius:8px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.85);border:2px solid ${isPersona ? '#f59e0b' : (isG4 ? '#818cf8' : '#38bdf8')};">
                    <img src="${rideCard.image || 'img/Card/dztd01_002.webp'}" style="width:100%;height:100%;object-fit:cover;" alt="${rideCard.name}">
                </div>
                <div style="font-weight:800;font-size:14px;color:#fff;margin-bottom:6px;">${rideCard.name} [Grade ${rideCard.grade}]</div>
                <div style="font-size:12px;color:#cbd5e1;margin-bottom:18px;line-height:1.45;">
                    ${isPersona
                        ? '<span style="color:#fbbf24;font-weight:700;">Lakukan Persona Ride dengan kartu ini?</span><br><small style="color:#94a3b8;">Efek: Draw 1 kartu & Front Row mendapatkan Power +10,000 permanen (menempel di baris depan) hingga akhir giliran!</small>'
                        : isG4
                        ? '<span style="color:#818cf8;font-weight:700;">Lakukan Ride ke Grade 4?</span><br><small style="color:#94a3b8;">Vanguard Grade 4 mendapatkan skill Triple Drive (3x Drive Check)!</small>'
                        : `Lakukan Normal Ride kartu "${rideCard.name}" ke Vanguard Circle?`
                    }
                </div>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button class="btn btn-primary" id="btnConfirmDoRide" style="font-weight:800;padding:8px 20px;">
                        ${isPersona ? 'Ya, Persona Ride!' : 'Ya, Lakukan Ride'}
                    </button>
                    <button class="btn btn-red" id="btnCancelDoRide" style="padding:8px 18px;">Batal</button>
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        document.getElementById('btnConfirmDoRide').onclick = () => {
            this.elModal.style.display = 'none';
            if (!this.dispatchAction('RIDE_FROM_HAND', { handIndex })) {
                this.engine.rideFromHand(handIndex);
            }
        };

        document.getElementById('btnCancelDoRide').onclick = () => {
            this.elModal.style.display = 'none';
        };
    }

    onCircleClick(playerNum, circleKey) {
        if (this.network && this.network.isOnline) {
            const isGuardStep = (this.engine.phase === 'GUARD_STEP');
            const defenderId = this.engine.getOpponentPlayer().id;
            if (isGuardStep) {
                if (this.network.myPlayerId !== defenderId) return;
            } else {
                if (this.network.myPlayerId !== this.engine.activePlayer) return;
            }
        }

        // Triumph Dragon AUTO: Retire target selection on opponent rear-guards
        if (this.retireTargetSelectionState && this.retireTargetSelectionState.active) {
            const opp = this.engine.getOpponentPlayer();
            if (playerNum === opp.id && circleKey.startsWith('rc_') && opp.circles[circleKey]) {
                const targetRetireKey = circleKey;
                this.retireTargetSelectionState = null;
                if (!this.dispatchAction('TRIUMPH_AUTO', { retireCircleKey: targetRetireKey })) {
                    this.engine.activateTriumphAuto(targetRetireKey);
                }
                this.renderAll();
                return;
            } else {
                this.engine.log("Pilih salah satu Rear-Guard lawan yang menyala merah untuk di-retire!", "warn");
                return;
            }
        }

        // Direct Field Target Selection for Triggers (no text picker)
        if (this.triggerSelectionState && this.triggerSelectionState.active) {
            const state = this.triggerSelectionState;
            const targetPlayer = state.payload.player;
            if (playerNum === targetPlayer.id) {
                const targetUnit = targetPlayer.circles[circleKey];
                if (targetUnit && !targetUnit.faceDown) {
                    this.handleTriggerTargetClick(circleKey);
                    return;
                }
            } else {
                this.engine.log(`Pilih salah satu unit milik ${targetPlayer.name} yang sedang menyala!`, "warn");
            }
            return;
        }

        const active = this.engine.getActivePlayer();

        if (this.engine.phase === 'MAIN_PHASE' && playerNum === active.id) {
            if (this.selectedHandIndex !== null) {
                if (circleKey.startsWith('rc_')) {
                    if (!this.dispatchAction('CALL_UNIT', { handIndex: this.selectedHandIndex, circleKey })) {
                        this.engine.callUnit(this.selectedHandIndex, circleKey);
                    }
                    this.selectedHandIndex = null;
                    this.selectedMoveSourceCircle = null;
                    this.renderAll();
                }
                return;
            }

            // Direct click on Vanguard to trigger ACT ability
            if (circleKey === 'vc') {
                const vcUnit = active.circles.vc;
                if (vcUnit && (vcUnit.card.id === 'DZ-TD01/001' || vcUnit.card.id === 'dz_002' || (vcUnit.card.name && vcUnit.card.name.toLowerCase().includes('triumph')))) {
                    if (this.engine.canActivateTriumphAct(active)) {
                        this.openTriumphActModal(active);
                    } else if (vcUnit.actUsedThisTurn) {
                        this.showSplash("Efek [ACT] Triumph Dragon sudah digunakan pada giliran ini (1/Turn)!", "amber");
                    } else if (!this.engine.canCounterBlast(active, 1)) {
                        this.showSplash("Perlu 1 kartu face-up di Damage Zone untuk Counter-Blast 1!", "red");
                    }
                    return;
                }
            }

            // Rear-guard Column Movement / Swap between Front & Back row
            const partnerMap = { 'rc_fl': 'rc_bl', 'rc_bl': 'rc_fl', 'rc_fr': 'rc_br', 'rc_br': 'rc_fr' };
            if (partnerMap[circleKey]) {
                if (this.selectedMoveSourceCircle === null) {
                    if (active.circles[circleKey]) {
                        this.selectedMoveSourceCircle = circleKey;
                        this.renderAll();
                    }
                } else if (this.selectedMoveSourceCircle === circleKey) {
                    // Deselect
                    this.selectedMoveSourceCircle = null;
                    this.renderAll();
                } else if (partnerMap[this.selectedMoveSourceCircle] === circleKey) {
                    // Execute Move or Swap!
                    if (!this.dispatchAction('MOVE_UNIT', { fromKey: this.selectedMoveSourceCircle, toKey: circleKey })) {
                        this.engine.moveOrSwapRearGuard(this.selectedMoveSourceCircle, circleKey);
                    }
                    this.selectedMoveSourceCircle = null;
                    this.renderAll();
                } else {
                    // Clicked a different column unit
                    if (active.circles[circleKey]) {
                        this.selectedMoveSourceCircle = circleKey;
                    } else {
                        this.selectedMoveSourceCircle = null;
                    }
                    this.renderAll();
                }
                return;
            }
        }

        if (this.engine.phase === 'GUARD_STEP' && playerNum === this.engine.getOpponentPlayer().id) {
            if (circleKey === 'rc_fl' || circleKey === 'rc_fr') {
                this.engine.intercept(circleKey);
            }
            return;
        }

        if (this.engine.phase === 'BATTLE_START') {
            if (playerNum === active.id) {
                const boostMap = { 'rc_fl': 'rc_bl', 'vc': 'rc_bc', 'rc_fr': 'rc_br' };
                const frontMap = { 'rc_bl': 'rc_fl', 'rc_bc': 'vc', 'rc_br': 'rc_fr' };

                // Clicking front row (Attacker)
                if (['vc', 'rc_fl', 'rc_fr'].includes(circleKey)) {
                    const unit = active.circles[circleKey];
                    if (unit && !unit.isRest) {
                        if (this.selectedAttackerCircle === circleKey) {
                            this.selectedAttackerCircle = null;
                            this.selectedBoosterCircle = null;
                        } else {
                            this.selectedAttackerCircle = circleKey;
                            if (this.selectedBoosterCircle && boostMap[circleKey] !== this.selectedBoosterCircle) {
                                this.selectedBoosterCircle = null;
                            }
                        }
                        this.renderAll();
                    }
                }
                // Clicking back row (Optional Booster)
                else if (['rc_bl', 'rc_bc', 'rc_br'].includes(circleKey)) {
                    const bUnit = active.circles[circleKey];
                    const frontKey = frontMap[circleKey];
                    const fUnit = active.circles[frontKey];

                    if (bUnit && !bUnit.isRest && (bUnit.card.grade <= 1 || bUnit.card.skill.includes('BOOST'))) {
                        if (this.selectedAttackerCircle === frontKey) {
                            // Toggle boost on / off
                            this.selectedBoosterCircle = (this.selectedBoosterCircle === circleKey) ? null : circleKey;
                        } else if (fUnit && !fUnit.isRest) {
                            this.selectedAttackerCircle = frontKey;
                            this.selectedBoosterCircle = circleKey;
                        }
                        this.renderAll();
                    }
                }
            } else if (this.selectedAttackerCircle) {
                // Clicking opponent target
                if (['vc', 'rc_fl', 'rc_fr'].includes(circleKey)) {
                    const opp = this.engine.getOpponentPlayer();
                    if (opp.circles[circleKey]) {
                        const atk = this.selectedAttackerCircle;
                        const bst = this.selectedBoosterCircle;
                        this.selectedAttackerCircle = null;
                        this.selectedBoosterCircle = null;
                        if (!this.dispatchAction('DECLARE_ATTACK', { attackerKey: atk, targetKey: circleKey, boosterKey: bst })) {
                            this.engine.declareAttack(atk, circleKey, bst);
                        }
                        this.renderAll();
                    }
                }
            }
        }
    }

    handleActionPhaseBtn() {
        if (this.dispatchAction('PHASE_BUTTON')) {
            return;
        }

        if (this.engine.phase === 'RIDE_PHASE') {
            const activeP = this.engine.getActivePlayer();
            const currentGrade = activeP.circles.vc ? activeP.circles.vc.card.grade : -1;
            if (currentGrade >= 3) {
                this.engine.skipRide();
            } else {
                this.showRideDeckModal();
            }
        } else if (this.engine.phase === 'MAIN_PHASE') {
            if (this.engine.turn === 1) {
                this.engine.endTurn();
            } else {
                this.engine.proceedToBattlePhase();
            }
        } else if (this.engine.phase === 'GUARD_STEP') {
            this.engine.finishGuardStep();
        }
    }

    handleEndTurn() {
        if (this.dispatchAction('END_TURN')) {
            return;
        }

        if (['MAIN_PHASE', 'BATTLE_START', 'RIDE_PHASE'].includes(this.engine.phase)) {
            this.engine.endTurn();
        }
    }

    togglePerspective() {
        this.viewPerspective = this.viewPerspective === 1 ? 2 : 1;
        this.renderAll();
    }

    toggleAutoPov() {
        this.autoPov = !this.autoPov;
        if (this.autoPov) {
            if (this.engine.phase === 'GUARD_STEP') {
                this.viewPerspective = this.engine.getOpponentPlayer().id;
            } else {
                this.viewPerspective = this.engine.activePlayer;
            }
        }
        this.renderAll();
    }

    showDiceRollModal() {
        const isOnline = (this.network && this.network.isOnline);
        const isGuest = (isOnline && !this.network.isHost);

        this.elModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-title">Penentuan Giliran (Roll Dice)</div>
                <p style="color:#94a3b8;font-size:13px;margin-bottom:20px;">
                    Kedua pemain melempar dadu. Pemenang berhak memilih jalan <b>Pertama (First)</b> atau <b>Kedua (Second)</b>.
                </p>

                <div class="dice-arena">
                    <div class="dice-player-box">
                        <span style="font-size:12px;font-weight:700;color:#f59e0b;">Player 1 (Host)</span>
                        <div class="dice-cube p1" id="cubeP1">?</div>
                    </div>
                    <div style="font-size:24px;font-weight:900;color:#64748b;">VS</div>
                    <div class="dice-player-box">
                        <span style="font-size:12px;font-weight:700;color:#0284c7;">Player 2 (Guest)</span>
                        <div class="dice-cube p2" id="cubeP2">?</div>
                    </div>
                </div>

                <div id="diceRollResultMsg" style="font-size:13px;font-weight:800;color:#38bdf8;margin-bottom:18px;">
                    ${isGuest ? '<span class="inline-spinner"></span> Menunggu Host (Player 1) melempar dadu...' : 'Klik tombol di bawah untuk melempar dadu!'}
                </div>

                <div id="diceActionsContainer">
                    ${isGuest ? '' : '<button class="btn btn-primary" id="btnDoRollDice" style="font-size:13px;padding:8px 22px;">Lempar Dadu</button>'}
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        if (isGuest) return;

        const btnRoll = document.getElementById('btnDoRollDice');
        if (!btnRoll) return;

        btnRoll.onclick = () => {
            btnRoll.disabled = true;

            let ticks = 0;
            const cube1 = document.getElementById('cubeP1');
            const cube2 = document.getElementById('cubeP2');
            const interval = setInterval(() => {
                cube1.textContent = Math.floor(Math.random() * 6) + 1;
                cube2.textContent = Math.floor(Math.random() * 6) + 1;
                ticks++;
                if (ticks > 12) {
                    clearInterval(interval);
                    const res = this.engine.rollDice();
                    cube1.textContent = res.d1;
                    cube2.textContent = res.d2;

                    const winnerName = res.winner === 1 ? 'Player 1' : 'Player 2';
                    const resultMsg = document.getElementById('diceRollResultMsg');
                    if (resultMsg) {
                        resultMsg.innerHTML = `<span style="color:#22c55e;">${winnerName} Menang Lemparan Dadu!</span>`;
                    }

                    const actionsCont = document.getElementById('diceActionsContainer');
                    if (actionsCont) {
                        if (isOnline && res.winner === 2) {
                            actionsCont.innerHTML = `<div style="font-size:12.5px;color:#38bdf8;font-weight:700;"><span class="inline-spinner"></span> Menunggu Player 2 (Guest) memilih urutan giliran...</div>`;
                        } else {
                            actionsCont.innerHTML = `
                                <div style="display:flex;gap:14px;justify-content:center;">
                                    <button class="btn btn-primary" id="btnChooseFirst">Jalan Pertama (First)</button>
                                    <button class="btn btn-cyan" id="btnChooseSecond">Jalan Kedua (Second)</button>
                                </div>
                            `;

                            document.getElementById('btnChooseFirst').onclick = () => {
                                this.elModal.style.display = 'none';
                                this.engine.chooseTurnOrder(res.winner);
                            };

                            document.getElementById('btnChooseSecond').onclick = () => {
                                this.elModal.style.display = 'none';
                                const other = res.winner === 1 ? 2 : 1;
                                this.engine.chooseTurnOrder(other);
                            };
                        }
                    }
                }
            }, 70);
        };
    }

    
    showDropZoneModal(playerNum) {
        const p = playerNum === 1 ? this.engine.p1 : this.engine.p2;
        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:860px;">
                <div class="modal-title">Drop Zone (${p.name})</div>
                <p style="color:#94a3b8;margin-bottom:12px;font-size:12px;">
                    Total Kartu: <b>${p.drop.length}</b>. Arahkan kursor ke kartu untuk melihat info lengkap di panel sisi kanan:
                </p>
                ${p.drop.length === 0 ? `
                    <div style="padding:40px;color:#64748b;font-size:13px;font-style:italic;">
                        Drop Zone masih kosong.
                    </div>
                ` : `
                    <div class="cards-selection-row" style="max-height:60vh;overflow-y:auto;padding:8px;" id="dropCardsListRow"></div>
                `}
                <div style="margin-top:16px;">
                    <button class="btn btn-primary" id="btnCloseDropModal">Tutup Drop Zone</button>
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        if (p.drop.length > 0) {
            const row = document.getElementById('dropCardsListRow');
            [...p.drop].reverse().forEach(card => {
                const cardEl = this.createCardElement(card);
                cardEl.className += ' selectable-item';
                cardEl.onmouseenter = () => this.inspectCard(card);
                row.appendChild(cardEl);
            });
        }

        document.getElementById('btnCloseDropModal').onclick = () => {
            this.elModal.style.display = 'none';
        };
    }

    showDriveCheckReveal(payload) {
        const hud = document.getElementById('inGameCardRevealHud');
        if (!hud) {
            this.engine.finishDriveCheckCard(payload.card);
            return;
        }

        if (this.revealTimer) {
            clearTimeout(this.revealTimer);
            this.revealTimer = null;
        }

        const card = payload.card;
        const stepStr = `${payload.step}/${payload.total}`;
        
        let triggerTagHtml = '';
        if (payload.isTrigger) {
            const tLower = payload.triggerType.toLowerCase();
            triggerTagHtml = `<div class="reveal-hud-trigger-tag ${tLower}">${payload.triggerType} TRIGGER</div>`;
        }

        hud.innerHTML = `
            <div class="reveal-hud-badge">DRIVE CHECK ${stepStr} (${payload.player.name})</div>
            <div class="reveal-hud-card-wrap ${payload.isTrigger ? 'has-trigger' : ''}">
                <img src="${card.image || 'img/Card/dztd01_002.webp'}" class="reveal-hud-art" alt="${card.name}">
                ${triggerTagHtml}
            </div>
            <div class="reveal-hud-info">
                <span class="reveal-hud-name">${card.name} [G${card.grade}]</span>
                <span class="reveal-hud-effect">${payload.isTrigger ? `Trigger ${payload.triggerType}! Masuk ke Hand...` : 'Normal Unit -> Hand'}</span>
            </div>
        `;
        hud.style.display = 'flex';

        try {
            this.inspectCard(card);
        } catch (e) {
            console.warn('Inspect card error:', e);
        }

        if (payload.isTrigger) {
            let transitioned = false;
            const doTransition = () => {
                if (transitioned) return;
                transitioned = true;
                if (this.revealTimer) {
                    clearTimeout(this.revealTimer);
                    this.revealTimer = null;
                }
                hud.style.display = 'none';
                hud.classList.remove('has-trigger');

                // Card immediately enters hand!
                this.engine.putDriveCardToHand(card);
                this.renderHands();

                // Now prompt unit selection on unobstructed field
                this.setupTriggerFlow(payload, null, () => {
                    this.engine.finishDriveCheckStep();
                });
            };

            hud.onclick = doTransition;
            this.revealTimer = setTimeout(doTransition, 750);
        } else {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                if (this.revealTimer) {
                    clearTimeout(this.revealTimer);
                    this.revealTimer = null;
                }
                hud.style.display = 'none';
                this.engine.finishDriveCheckCard(card);
            };

            hud.onclick = finish;
            this.revealTimer = setTimeout(finish, 1100);
        }
    }

    showDamageCheckReveal(payload) {
        const hud = document.getElementById('inGameCardRevealHud');
        if (!hud) {
            this.engine.finishDamageCheckCard(payload.card, payload.total, payload.step);
            return;
        }

        if (this.revealTimer) {
            clearTimeout(this.revealTimer);
            this.revealTimer = null;
        }

        const card = payload.card;
        const stepStr = `${payload.step}/${payload.total}`;
        
        let triggerTagHtml = '';
        if (payload.isTrigger) {
            const tLower = payload.triggerType.toLowerCase();
            triggerTagHtml = `<div class="reveal-hud-trigger-tag ${tLower}">${payload.triggerType} TRIGGER</div>`;
        }

        hud.innerHTML = `
            <div class="reveal-hud-badge damage-step">DAMAGE CHECK ${stepStr} (${payload.player.damage.length + 1}/6)</div>
            <div class="reveal-hud-card-wrap damage-glow ${payload.isTrigger ? 'has-trigger' : ''}">
                <img src="${card.image || 'img/Card/dztd01_002.webp'}" class="reveal-hud-art" alt="${card.name}">
                ${triggerTagHtml}
            </div>
            <div class="reveal-hud-info">
                <span class="reveal-hud-name">${card.name} [G${card.grade}]</span>
                <span class="reveal-hud-effect">${payload.isTrigger ? `Trigger ${payload.triggerType}!` : '-> Damage Zone'}</span>
            </div>
        `;
        hud.style.display = 'flex';

        try {
            this.inspectCard(card);
        } catch (e) {
            console.warn('Inspect card error:', e);
        }

        if (payload.isTrigger) {
            let transitioned = false;
            const doTransition = () => {
                if (transitioned) return;
                transitioned = true;
                if (this.revealTimer) {
                    clearTimeout(this.revealTimer);
                    this.revealTimer = null;
                }
                hud.style.display = 'none';
                hud.classList.remove('has-trigger');

                this.setupTriggerFlow(payload, null, () => {
                    this.engine.finishDamageCheckCard(card, payload.total, payload.step);
                });
            };

            hud.onclick = doTransition;
            this.revealTimer = setTimeout(doTransition, 750);
        } else {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                if (this.revealTimer) {
                    clearTimeout(this.revealTimer);
                    this.revealTimer = null;
                }
                hud.style.display = 'none';
                this.engine.finishDamageCheckCard(card, payload.total, payload.step);
            };

            hud.onclick = finish;
            this.revealTimer = setTimeout(finish, 1100);
        }
    }

    getEligibleTriggerUnits(player) {
        const circleKeys = ['vc', 'rc_fl', 'rc_fr', 'rc_bl', 'rc_bc', 'rc_br'];
        const list = [];
        circleKeys.forEach(k => {
            const u = player.circles[k];
            if (u && !u.faceDown) {
                list.push({ key: k, unit: u });
            }
        });
        return list;
    }

    setupTriggerFlow(payload, hud, onCardFinished) {
        if (hud) {
            hud.style.display = 'none';
            hud.classList.remove('has-trigger');
        }
        const player = payload.player;
        const triggerType = payload.triggerType;

        // 1. FRONT TRIGGER: +10,000 to all front-row units automatically (no single selection)
        if (triggerType === 'FRONT') {
            this.triggerSelectionState = null;
            this.engine.applyTriggerAdditional(player, 'FRONT');
            this.showTriggerPromptPill(`FRONT TRIGGER! Seluruh Front Row Power +10,000`);
            this.renderAll();
            setTimeout(() => {
                this.hideTriggerPromptPill();
                onCardFinished();
            }, 850);
            return;
        }

        const powerAmount = triggerType === 'OVER' ? 100000000 : 10000;
        const eligible = this.getEligibleTriggerUnits(player);

        // 2. Only 1 unit on field (e.g. only Vanguard): Auto-allocate to that unit!
        if (eligible.length <= 1) {
            this.triggerSelectionState = null;
            const targetKey = eligible.length === 1 ? eligible[0].key : 'vc';
            const targetUnit = player.circles[targetKey];
            const targetName = targetUnit ? targetUnit.card.name : 'Vanguard';

            this.engine.applyTriggerPower(player, targetKey, powerAmount);
            if (triggerType === 'CRITICAL') {
                this.engine.applyTriggerCritical(player, targetKey, 1);
            }
            this.engine.applyTriggerAdditional(player, triggerType);

            const critText = triggerType === 'CRITICAL' ? ' & Crit +1' : '';
            this.showTriggerPromptPill(`Power +${powerAmount.toLocaleString()}${critText} -> ${targetName}!`);
            this.renderAll();
            setTimeout(() => {
                this.hideTriggerPromptPill();
                onCardFinished();
            }, 850);
            return;
        }

        // 3. Multiple units on field: Player selects unit directly by clicking on the field
        this.showTriggerPromptPill(`KLIK UNIT DI FIELD (${player.name}) UNTUK POWER +${powerAmount.toLocaleString()}!`);

        this.triggerSelectionState = {
            active: true,
            step: 'POWER',
            payload: payload,
            onFinish: () => {
                this.hideTriggerPromptPill();
                onCardFinished();
            }
        };
        this.renderAll();
    }

    handleTriggerTargetClick(circleKey) {
        if (!this.triggerSelectionState || !this.triggerSelectionState.active) return;
        const state = this.triggerSelectionState;
        const player = state.payload.player;
        const triggerType = state.payload.triggerType;
        const powerAmount = triggerType === 'OVER' ? 100000000 : 10000;
        const unit = player.circles[circleKey];
        const unitName = unit ? unit.card.name : circleKey.toUpperCase();

        if (state.step === 'POWER') {
            state.powerTarget = circleKey;
            this.engine.applyTriggerPower(player, circleKey, powerAmount);
            this.showFloatingBuffFX(player.id, circleKey, `+${powerAmount.toLocaleString()}`, 'power');

            if (triggerType === 'CRITICAL') {
                state.step = 'CRITICAL';
                this.showTriggerPromptPill(`KLIK UNIT DI FIELD (${player.name}) UNTUK CRITICAL +1`);
                this.renderAll();
            } else {
                this.engine.applyTriggerAdditional(player, triggerType);
                this.showTriggerPromptPill(`Power +${powerAmount.toLocaleString()} -> ${unitName}!`);
                this.renderAll();
                state.active = false;
                this.triggerSelectionState = null;
                setTimeout(() => {
                    this.hideTriggerPromptPill();
                    if (state.onFinish) state.onFinish();
                }, 500);
            }
        } else if (state.step === 'CRITICAL') {
            state.critTarget = circleKey;
            this.engine.applyTriggerCritical(player, circleKey, 1);
            this.engine.applyTriggerAdditional(player, 'CRITICAL');
            this.showFloatingBuffFX(player.id, circleKey, `+1 CRIT`, 'crit');
            this.showTriggerPromptPill(`Critical +1 -> ${unitName}!`);
            this.renderAll();
            state.active = false;
            this.triggerSelectionState = null;
            setTimeout(() => {
                this.hideTriggerPromptPill();
                if (state.onFinish) state.onFinish();
            }, 500);
        }
    }

    showMulliganModal(playerNum) {
        const p = playerNum === 1 ? this.engine.p1 : this.engine.p2;
        this.selectedMulliganIndices = [];

        this.elModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-title">Opening Hand Mulligan (${p.name})</div>
                <p style="color:#94a3b8;margin-bottom:12px;font-size:12px;">Pilih kartu yang ingin dikembalikan ke bawah deck, lalu ambil kartu pengganti:</p>
                <div class="cards-selection-row" id="mulliganCardsRow"></div>
                <div style="display:gap:10px;justify-content:center;">
                    <button class="btn btn-primary" id="btnConfirmMulligan">Konfirmasi Mulligan</button>
                    <button class="btn" id="btnKeepHand">Pertahankan Semua Kartu</button>
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        const row = document.getElementById('mulliganCardsRow');
        p.hand.forEach((card, idx) => {
            const cardEl = this.createCardElement(card);
            cardEl.className += ' selectable-item';
            cardEl.onclick = () => {
                const found = this.selectedMulliganIndices.indexOf(idx);
                if (found === -1) {
                    this.selectedMulliganIndices.push(idx);
                    cardEl.classList.add('selected');
                } else {
                    this.selectedMulliganIndices.splice(found, 1);
                    cardEl.classList.remove('selected');
                }
            };
            cardEl.onmouseenter = () => this.inspectCard(card);
            row.appendChild(cardEl);
        });

        document.getElementById('btnConfirmMulligan').onclick = () => {
            this.elModal.style.display = 'none';
            if (this.network && this.network.isOnline) {
                if (this.network.isHost) {
                    this.engine.performMulligan(1, this.selectedMulliganIndices);
                } else {
                    this.dispatchAction('MULLIGAN', { indices: this.selectedMulliganIndices });
                }
            } else {
                this.engine.performMulligan(playerNum, this.selectedMulliganIndices);
                if (playerNum === 1 && !this.engine.p2.mulliganDone) {
                    setTimeout(() => this.showMulliganModal(2), 400);
                }
            }
        };

        document.getElementById('btnKeepHand').onclick = () => {
            this.elModal.style.display = 'none';
            if (this.network && this.network.isOnline) {
                if (this.network.isHost) {
                    this.engine.performMulligan(1, []);
                } else {
                    this.dispatchAction('MULLIGAN', { indices: [] });
                }
            } else {
                this.engine.performMulligan(playerNum, []);
                if (playerNum === 1 && !this.engine.p2.mulliganDone) {
                    setTimeout(() => this.showMulliganModal(2), 400);
                }
            }
        };
    }

    showRideDeckModal() {
        const p = this.engine.getActivePlayer();
        const currentGrade = p.circles.vc ? p.circles.vc.card.grade : -1;
        const targetGrade = currentGrade + 1;

        if (currentGrade >= 3) {
            this.engine.skipRide();
            return;
        }

        const rideOptions = [];
        p.rideDeck.forEach((c, idx) => {
            if (c.grade === targetGrade) {
                rideOptions.push({ card: c, idx });
            }
        });

        if (rideOptions.length === 0) {
            alert(`Tidak ada kartu Grade ${targetGrade} di Ride Deck Anda!`);
            this.engine.skipRide();
            return;
        }

        if (p.hand.length === 0) {
            alert('Anda membutuhkan minimal 1 kartu di tangan untuk di-discard!');
            return;
        }

        let selectedRideIdx = rideOptions[0].idx;
        let selectedHandDiscardIdx = null;

        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:860px;">
                <div class="modal-title">Ride Phase (${p.name})</div>
                
                <div style="margin-bottom:14px;">
                    <p style="color:#f59e0b;font-weight:700;font-size:12px;margin-bottom:6px;">
                        1. Pilih Kartu yang Mau Di-Ride dari Ride Deck (Grade ${targetGrade}):
                    </p>
                    <div class="cards-selection-row" id="rideCardsRow"></div>
                </div>

                <div style="margin-bottom:14px;">
                    <p style="color:#38bdf8;font-weight:700;font-size:12px;margin-bottom:6px;">
                        2. Pilih 1 Kartu dari Tangan untuk Di-Discard sebagai Biaya:
                    </p>
                    <div class="cards-selection-row" id="discardCardsRow"></div>
                </div>

                <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
                    <button class="btn btn-primary" id="btnConfirmRide" disabled>Konfirmasi Ride</button>
                    <button class="btn" id="btnSkipRide">Lewati Ride (Skip)</button>
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        const rideRow = document.getElementById('rideCardsRow');
        rideOptions.forEach(({ card, idx }) => {
            const cardEl = this.createCardElement(card);
            cardEl.className += ' selectable-item selected';
            cardEl.onclick = () => {
                rideRow.querySelectorAll('.selectable-item').forEach(el => el.classList.remove('selected'));
                cardEl.classList.add('selected');
                selectedRideIdx = idx;
                updateConfirmBtn();
            };
            cardEl.onmouseenter = () => this.inspectCard(card);
            rideRow.appendChild(cardEl);
        });

        const discardRow = document.getElementById('discardCardsRow');
        const btnRide = document.getElementById('btnConfirmRide');

        const updateConfirmBtn = () => {
            if (selectedRideIdx !== null && selectedHandDiscardIdx !== null) {
                btnRide.disabled = false;
                btnRide.textContent = `Konfirmasi Ride ${p.rideDeck[selectedRideIdx].name}`;
            } else {
                btnRide.disabled = true;
            }
        };

        p.hand.forEach((card, idx) => {
            const cardEl = this.createCardElement(card);
            cardEl.className += ' selectable-item';
            cardEl.onclick = () => {
                discardRow.querySelectorAll('.selectable-item').forEach(el => el.classList.remove('selected'));
                cardEl.classList.add('selected');
                selectedHandDiscardIdx = idx;
                updateConfirmBtn();
            };
            cardEl.onmouseenter = () => this.inspectCard(card);
            discardRow.appendChild(cardEl);
        });

        btnRide.onclick = () => {
            if (selectedRideIdx !== null && selectedHandDiscardIdx !== null) {
                this.elModal.style.display = 'none';
                if (!this.dispatchAction('RIDE_FROM_RIDE_DECK', { rideDeckIndex: selectedRideIdx, discardHandIndex: selectedHandDiscardIdx })) {
                    this.engine.rideFromRideDeck(selectedRideIdx, selectedHandDiscardIdx);
                    this.engine.proceedToMainPhase();
                }
            }
        };

        document.getElementById('btnSkipRide').onclick = () => {
            this.elModal.style.display = 'none';
            if (!this.dispatchAction('SKIP_RIDE')) {
                this.engine.skipRide();
            }
        };
    }

    showSplash(text, type = 'gold') {
        if (!this.elTriggerSplash) return;

        let icon = 'ℹ️';
        let borderColor = '#38bdf8';
        if (type === 'emerald' || type === 'green') {
            icon = '';
            borderColor = '#10b981';
        } else if (type === 'gold' || type === 'amber') {
            icon = '';
            borderColor = '#f59e0b';
        } else if (type === 'red') {
            icon = '';
            borderColor = '#ef4444';
        } else if (type === 'pink') {
            icon = '';
            borderColor = '#ec4899';
        } else if (type === 'cyan') {
            icon = '';
            borderColor = '#06b6d4';
        }

        this.elTriggerSplash.innerHTML = `<span style="font-size:15px;line-height:1;flex-shrink:0;">${icon}</span><span>${text}</span>`;
        this.elTriggerSplash.style.borderLeftColor = borderColor;
        this.elTriggerSplash.style.display = 'flex';
        this.elTriggerSplash.style.opacity = '1';
        this.elTriggerSplash.style.transform = 'translateY(0)';

        if (this._splashTimer) clearTimeout(this._splashTimer);
        this._splashTimer = setTimeout(() => {
            if (this.elTriggerSplash) {
                this.elTriggerSplash.style.opacity = '0';
                this.elTriggerSplash.style.transform = 'translateY(8px)';
                setTimeout(() => {
                    if (this.elTriggerSplash) this.elTriggerSplash.style.display = 'none';
                }, 250);
            }
        }, 2200);
    }

    showGameOverModal(winner, reason) {
        this.elModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-title">VICTORY FOR PLAYER ${winner}!</div>
                <p style="color:#94a3b8;font-size:15px;margin:18px 0;">Reason: ${reason}</p>
                <button class="btn btn-primary" onclick="location.reload()">Kembali ke Main Menu</button>
            </div>
        `;
        this.elModal.style.display = 'flex';
    }

    showCreateRoomModal() {
        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:440px;text-align:center;">
                <div class="modal-title">Create Room (P2P Online)</div>
                <p style="color:#94a3b8;font-size:12px;margin-bottom:16px;">
                    Multiplayer online P2P WebRTC (bisa dimainkan jarak jauh via GitHub Pages tanpa backend database).
                </p>
                <div style="margin:20px 0;" id="createRoomStatus">
                    <div style="font-size:13px;color:#38bdf8;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">
                        <span class="inline-spinner"></span> Menghubungkan ke Signaling Server...
                    </div>
                </div>
                <button class="btn" onclick="document.getElementById('gameModal').style.display='none'">Batal</button>
            </div>
        `;
        this.elModal.style.display = 'flex';

        this.network.createRoom(
            (roomId) => {
                const el = document.getElementById('createRoomStatus');
                if (!el) return;
                el.innerHTML = `
                    <div style="color:#f1f5f9;font-size:13px;font-weight:700;margin-bottom:8px;">Room Berhasil Dibuat!</div>
                    <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Bagikan Room ID ini kepada lawan:</div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;">
                        <input type="text" readonly id="generatedRoomIdInput" value="${roomId}" 
                            style="background:rgba(255,255,255,0.08);border:1px solid #f59e0b;padding:8px 12px;border-radius:6px;font-size:16px;color:#f59e0b;font-weight:900;text-align:center;letter-spacing:1px;width:180px;">
                        <button class="btn btn-primary" id="btnCopyRoomId" style="padding:8px 14px;font-size:12px;font-weight:700;">Salin ID</button>
                    </div>
                    <div id="copyNotice" style="display:none;font-size:11px;color:#10b981;font-weight:700;margin-bottom:8px;">Tersalin ke clipboard!</div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:#38bdf8;font-weight:600;">
                        <span class="pulse-indicator"></span> Menunggu Player 2 masuk...
                    </div>
                `;
                const btnCopy = document.getElementById('btnCopyRoomId');
                if (btnCopy) {
                    btnCopy.onclick = () => {
                        const copyInput = document.getElementById('generatedRoomIdInput');
                        if (copyInput) {
                            copyInput.select();
                            navigator.clipboard.writeText(copyInput.value).then(() => {
                                const notice = document.getElementById('copyNotice');
                                if (notice) {
                                    notice.style.display = 'block';
                                    setTimeout(() => { if (notice) notice.style.display = 'none'; }, 2000);
                                }
                            });
                        }
                    };
                }
            },
            (errText) => {
                const el = document.getElementById('createRoomStatus');
                if (el) {
                    el.innerHTML = `
                        <div style="color:#ef4444;font-size:13px;font-weight:700;margin-bottom:8px;">Gagal Membuat Room</div>
                        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">${errText}</div>
                        <button class="btn btn-primary" onclick="if(window.vgUI) window.vgUI.showCreateRoomModal()">Coba Lagi</button>
                    `;
                }
            }
        );
    }

    showEnterRoomModal() {
        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:440px;text-align:center;">
                <div class="modal-title">Enter Room (Gabung Match)</div>
                <p style="color:#94a3b8;font-size:12px;margin-bottom:16px;">Masukkan Room ID yang dibagikan oleh Host (Player 1):</p>
                <div style="display:flex;gap:8px;max-width:340px;margin:0 auto 16px auto;">
                    <input type="text" id="inputJoinRoomId" placeholder="contoh: vg-abc123" 
                        style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.25);padding:8px 12px;border-radius:6px;color:#fff;font-size:14px;font-weight:700;text-align:center;">
                    <button class="btn btn-primary" id="btnConfirmJoin" style="padding:8px 18px;font-weight:700;">Join</button>
                </div>
                <div id="joinStatus" style="font-size:12px;color:#38bdf8;margin-bottom:12px;min-height:18px;"></div>
                <button class="btn" onclick="document.getElementById('gameModal').style.display='none'">Batal</button>
            </div>
        `;
        this.elModal.style.display = 'flex';

        const btnJoin = document.getElementById('btnConfirmJoin');
        if (btnJoin) {
            btnJoin.onclick = () => {
                const rid = document.getElementById('inputJoinRoomId').value.trim();
                if (!rid) {
                    document.getElementById('joinStatus').innerHTML = '<span style="color:#ef4444;">Masukkan Room ID terlebih dahulu.</span>';
                    return;
                }
                document.getElementById('joinStatus').innerHTML = `<span style="color:#38bdf8;"><span class="inline-spinner"></span> Menghubungkan ke Host (${rid})...</span>`;
                btnJoin.disabled = true;

                this.network.joinRoom(
                    rid,
                    () => {
                        this.elModal.style.display = 'none';
                        this.showView('viewGamePlay');
                        this.viewPerspective = 2;
                        const myDeckKey = this.selectedP2DeckKey || ((typeof getActiveDeckId === 'function') ? (getActiveDeckId() || 'bastion_sanctuary') : 'bastion_sanctuary');
                        this.network.sendAction('PLAYER_HELLO', {
                            deckKey: myDeckKey
                        });
                        this.engine.log(`Terhubung ke Room: ${rid}! Menunggu inisialisasi match dari Host...`, "highlight");
                    },
                    (errText) => {
                        btnJoin.disabled = false;
                        document.getElementById('joinStatus').innerHTML = `<span style="color:#ef4444;">Gagal join: ${errText}</span>`;
                    }
                );
            };
        }
    }

    // =========================================================
    // DECK BUILDER & MANAGER SYSTEM
    // =========================================================
    bindDeckBuilderEvents() {
        // Mode 1: Deck Manager Back to Main Menu
        const btnBack = document.getElementById('btnDeckBuilderBack');
        if (btnBack) {
            btnBack.onclick = () => this.showView('viewMainMenu');
        }

        // "+ Buat Deck Baru" -> Enter Mode 2 (Deck Builder) with empty deck
        const btnCreate = document.getElementById('btnCreateNewDeck');
        if (btnCreate) {
            btnCreate.onclick = () => this.openDeckEditor(null);
        }

        // Mode 2: "← Batal" -> Return to Mode 1 (Deck Manager)
        const btnCancel = document.getElementById('btnCancelDeckEdit');
        if (btnCancel) {
            btnCancel.onclick = () => this.closeDeckEditor();
        }

        // Mode 2: "Simpan Deck"
        const btnSave = document.getElementById('btnSaveDeck');
        if (btnSave) {
            btnSave.onclick = () => this.saveCurrentEditingDeck();
        }

        // Mode 2: "Reset / Kosongkan"
        const btnClear = document.getElementById('btnClearDeck');
        if (btnClear) {
            btnClear.onclick = () => {
                if (confirm('Kosongkan semua kartu dalam deck yang sedang dibuat?')) {
                    this.editingDeck.mainDeckIds = [];
                    this.editingDeck.rideDeck = { g0: null, g1: null, g2: null, g3: null, crest: 'dz_005' };
                    this.renderDeckEditorState();
                }
            };
        }

        // Mode 1: Deck Preview Action Buttons
        const btnSetActive = document.getElementById('btnSetActiveDeck');
        if (btnSetActive) {
            btnSetActive.onclick = () => {
                if (this.selectedDeckKey) {
                    setActiveDeckId(this.selectedDeckKey);
                    this.renderSavedDecksList();
                    this.showDeckPreview(this.selectedDeckKey);
                    this.showSplash('Deck aktif dipilih!', 'gold');
                }
            };
        }

        const btnEditSel = document.getElementById('btnEditSelectedDeck');
        if (btnEditSel) {
            btnEditSel.onclick = () => {
                if (this.selectedDeckKey) {
                    this.openDeckEditor(this.selectedDeckKey);
                }
            };
        }

        const btnDelSel = document.getElementById('btnDeleteSelectedDeck');
        if (btnDelSel) {
            btnDelSel.onclick = () => {
                if (!this.selectedDeckKey) return;
                const decks = getSavedDecks();
                const d = decks[this.selectedDeckKey];
                if (!d) return;
                if (confirm(`Hapus deck "${d.name}"?`)) {
                    deleteDeckFromStorage(this.selectedDeckKey);
                    const remainingKeys = Object.keys(getSavedDecks());
                    this.selectedDeckKey = remainingKeys[0] || null;
                    this.renderSavedDecksList();
                    if (this.selectedDeckKey) this.showDeckPreview(this.selectedDeckKey);
                }
            };
        }

        const btnExportSel = document.getElementById('btnExportSelectedDeck');
        if (btnExportSel) {
            btnExportSel.onclick = () => {
                if (!this.selectedDeckKey) return;
                const decks = getSavedDecks();
                const d = decks[this.selectedDeckKey];
                if (d) this.exportDeckToJson(d);
            };
        }

        const btnExportEdt = document.getElementById('btnExportEditingDeck');
        if (btnExportEdt) {
            btnExportEdt.onclick = () => {
                if (this.editingDeck) {
                    const deckToExport = this.compileEditingDeckObject();
                    this.exportDeckToJson(deckToExport);
                }
            };
        }

        const btnImport = document.getElementById('btnImportDeckJson');
        const fileImport = document.getElementById('fileImportDeck');
        if (btnImport && fileImport) {
            btnImport.onclick = () => fileImport.click();
            fileImport.onchange = (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const parsed = JSON.parse(evt.target.result);
                        this.importDeckFromJson(parsed);
                    } catch (err) {
                        alert('Format JSON deck tidak valid: ' + err.message);
                    }
                    fileImport.value = '';
                };
                reader.readAsText(file);
            };
        }

        // Catalog Filter Buttons in Deck Editor
        document.querySelectorAll('.catalog-filter-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.catalog-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.editorFilter = btn.dataset.filter || 'all';
                this.renderEditorCatalog();
            };
        });

        // Nation Selector in Deck Editor
        const selectNation = document.getElementById('selectDeckNation');
        if (selectNation) {
            selectNation.onchange = () => {
                if (this.editingDeck) {
                    this.editingDeck.nation = selectNation.value;
                    this.renderEditorCatalog();
                }
            };
        }
    }

    renderSavedDecksList() {
        const container = document.getElementById('savedDecksContainer');
        if (!container) return;
        container.innerHTML = '';
        const decks = getSavedDecks();
        const activeId = getActiveDeckId();
        const deckKeys = Object.keys(decks);

        if (!this.selectedDeckKey || !decks[this.selectedDeckKey]) {
            this.selectedDeckKey = activeId && decks[activeId] ? activeId : deckKeys[0];
        }

        deckKeys.forEach(key => {
            const deck = decks[key];
            const card = document.createElement('div');
            card.className = `deck-card-summary ${key === this.selectedDeckKey ? 'active-deck-card' : ''}`;
            const isActive = (key === activeId);

            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h4 style="margin:0;font-size:13px;color:#f59e0b;">${deck.name}</h4>
                    ${isActive ? '<span style="background:#10b981;color:#000;font-size:9px;font-weight:800;padding:1px 6px;border-radius:10px;">AKTIF</span>' : ''}
                </div>
                <p style="margin:4px 0 2px 0;">Bangsa: <span style="color:#fff;">${deck.nation}</span></p>
                <p style="margin:0;">Main: ${deck.mainDeckIds ? deck.mainDeckIds.length : 0}/50 | Ride: ${deck.rideDeckIds ? deck.rideDeckIds.length : 0}/5</p>
            `;

            card.onclick = () => {
                this.selectedDeckKey = key;
                this.renderSavedDecksList();
                this.showDeckPreview(key);
            };

            container.appendChild(card);
        });

        if (this.selectedDeckKey) {
            this.showDeckPreview(this.selectedDeckKey);
        }
    }

    showDeckPreview(deckKey) {
        const decks = getSavedDecks();
        const deck = decks[deckKey];
        if (!deck) return;

        // Name & Nation
        const nameEl = document.getElementById('previewDeckName');
        const nationEl = document.getElementById('previewDeckNation');
        if (nameEl) nameEl.textContent = deck.name;
        if (nationEl) nationEl.textContent = `Bangsa: ${deck.nation}`;

        // Stats Bar
        const statsBar = document.getElementById('previewStatsBar');
        if (statsBar) {
            let trgCount = 0, critCount = 0, drawCount = 0, frontCount = 0, healCount = 0, overCount = 0;
            (deck.mainDeckIds || []).forEach(id => {
                const c = getCardById(id);
                if (c && c.trigger !== 'NONE') {
                    trgCount++;
                    if (c.trigger === 'CRITICAL') critCount++;
                    else if (c.trigger === 'DRAW') drawCount++;
                    else if (c.trigger === 'FRONT') frontCount++;
                    else if (c.trigger === 'HEAL') healCount++;
                    else if (c.trigger === 'OVER') overCount++;
                }
            });

            statsBar.innerHTML = `
                <span>Main Deck: <b>${deck.mainDeckIds ? deck.mainDeckIds.length : 0}</b>/50</span>
                <span>Ride Deck: <b>${deck.rideDeckIds ? deck.rideDeckIds.length : 0}</b>/5</span>
                <span>Triggers: <b>${trgCount}</b>/16 (Crit: ${critCount}, Draw: ${drawCount}, Front: ${frontCount}, Heal: ${healCount}, Over: ${overCount})</span>
            `;
        }

        // Ride Deck Preview
        const rideRow = document.getElementById('previewRideDeckRow');
        if (rideRow) {
            rideRow.innerHTML = '';
            (deck.rideDeckIds || []).forEach(id => {
                const c = getCardById(id);
                if (!c) return;
                const item = document.createElement('div');
                item.className = 'deck-preview-card-item';
                item.style.width = '78px';
                item.innerHTML = `<img src="${c.image || 'img/Card/dztd01_002.webp'}" alt="${c.name}">`;
                item.title = `${c.name} (${c.isCrest ? 'Crest' : 'G' + c.grade})`;
                item.onmouseenter = () => this.inspectCard(c);
                rideRow.appendChild(item);
            });
        }

        // Main Deck Preview
        const mainGrid = document.getElementById('previewMainDeckGrid');
        if (mainGrid) {
            mainGrid.innerHTML = '';
            const cardCounts = {};
            (deck.mainDeckIds || []).forEach(id => {
                cardCounts[id] = (cardCounts[id] || 0) + 1;
            });

            // Sort cards by Grade descending, then name
            const sortedIds = Object.keys(cardCounts).sort((a, b) => {
                const ca = getCardById(a);
                const cb = getCardById(b);
                if (!ca || !cb) return 0;
                if (cb.grade !== ca.grade) return cb.grade - ca.grade;
                return ca.name.localeCompare(cb.name);
            });

            sortedIds.forEach(id => {
                const c = getCardById(id);
                if (!c) return;
                const count = cardCounts[id];
                const item = document.createElement('div');
                item.className = 'deck-preview-card-item';
                item.innerHTML = `
                    <img src="${c.image || 'img/Card/dztd01_002.webp'}" alt="${c.name}">
                    <span class="badge-card-count">x${count}</span>
                `;
                item.title = `${c.name} (x${count})`;
                item.onmouseenter = () => this.inspectCard(c);
                mainGrid.appendChild(item);
            });
        }
    }

    openDeckEditor(deckKeyOrNull) {
        // Show Mode 2 (Deck Builder), hide Mode 1 (Deck Manager)
        document.getElementById('deckManagerView').style.display = 'none';
        document.getElementById('deckEditorView').style.display = 'flex';

        this.editorFilter = 'all';
        this.selectedRideSlot = null;

        if (deckKeyOrNull) {
            // Edit existing deck
            const decks = getSavedDecks();
            const existing = decks[deckKeyOrNull];
            if (existing) {
                this.editingDeck = {
                    id: existing.id,
                    name: existing.name,
                    nation: existing.nation || 'Dragon Empire',
                    rideDeck: {
                        g0: existing.rideDeckIds.find(id => { const c = getCardById(id); return c && c.grade === 0 && !c.isCrest; }) || null,
                        g1: existing.rideDeckIds.find(id => { const c = getCardById(id); return c && c.grade === 1; }) || null,
                        g2: existing.rideDeckIds.find(id => { const c = getCardById(id); return c && c.grade === 2; }) || null,
                        g3: existing.rideDeckIds.find(id => { const c = getCardById(id); return c && c.grade === 3; }) || null,
                        crest: 'dz_005'
                    },
                    mainDeckIds: [...(existing.mainDeckIds || [])]
                };
            }
        } else {
            // + Buat Deck Baru: All empty except Energy Generator Crest!
            this.editingDeck = {
                id: `custom_${Date.now()}`,
                name: 'Deck Kustom Baru',
                nation: 'Dragon Empire',
                rideDeck: {
                    g0: null,
                    g1: null,
                    g2: null,
                    g3: null,
                    crest: 'dz_005' // Locked Energy Generator
                },
                mainDeckIds: [] // Kosong total
            };
        }

        // Set inputs
        document.getElementById('inputDeckName').value = this.editingDeck.name;
        document.getElementById('selectDeckNation').value = this.editingDeck.nation;

        // Default inspect Energy Generator
        this.updateBuilderInspector(getCardById('dz_005'));

        // Render catalog & deck slots
        this.renderEditorCatalog();
        this.renderDeckEditorState();
    }

    closeDeckEditor() {
        document.getElementById('deckEditorView').style.display = 'none';
        document.getElementById('deckManagerView').style.display = 'flex';
        this.renderSavedDecksList();
    }

    updateBuilderInspector(card) {
        if (!card) return;
        const art = document.getElementById('builderCardArt');
        if (art) art.src = card.image || 'img/Card/dztd01_002.webp';

        const nameEl = document.getElementById('builderCardName');
        if (nameEl) nameEl.textContent = card.name;

        const badgesEl = document.getElementById('builderCardBadges');
        if (badgesEl) {
            const cat = getCardCategory(card);
            const isUniversal = typeof isCrayElementalNation === 'function' && isCrayElementalNation(card.nation);
            badgesEl.innerHTML = `<span class="badge-tag tag-type" ${isUniversal ? 'style="border-color:#10b981;color:#6ee7b7;background:rgba(16,185,129,0.15);"' : ''}>[${cat}] ${card.nation}${isUniversal ? ' Universal' : ''}</span>`;
        }

        const statsEl = document.getElementById('builderCardStats');
        if (statsEl) {
            if (card.isCrest) {
                statsEl.innerHTML = `<span class="stat-pill-grade">Crest Zone</span>`;
            } else {
                let html = `<span class="stat-pill-grade">Grade ${card.grade}</span>`;
                if (card.basePower > 0) html += `<span class="stat-pill-power">Power ${card.basePower.toLocaleString()}</span>`;
                if (card.baseCritical > 0) html += `<span class="stat-pill-crit">Crit ${card.baseCritical}</span>`;
                if (card.baseShield > 0) html += `<span class="stat-pill-power" style="background:#059669;">Shield +${card.baseShield.toLocaleString()}</span>`;
                statsEl.innerHTML = html;
            }
        }

        const abilitiesEl = document.getElementById('builderCardAbilities');
        if (abilitiesEl) {
            abilitiesEl.innerHTML = this.formatAbilityText(card.ability || 'No special abilities.');
        }
    }

    renderEditorCatalog() {
        const grid = document.getElementById('builderCatalogGrid');
        if (!grid) return;
        grid.innerHTML = '';

        const nation = this.editingDeck ? this.editingDeck.nation : 'Dragon Empire';
        const filter = this.editorFilter || 'all';

        const filtered = CARD_CATALOG.filter(c => {
            const isUniversal = typeof isCrayElementalNation === 'function' ? isCrayElementalNation(c.nation) : (c.nation === 'Cray Elemental' || c.nation === 'Elemental Cray');
            if (c.nation !== nation && !isUniversal) return false;
            if (c.isCrest) return false; // Crest is locked in ride deck, not picked in catalog
            if (c.isToken) return false; // Tokens have their own zone/pool
            const cat = getCardCategory(c);
            const isOrder = ['Normal Order', 'Set Order', 'Blitz Order'].includes(cat) || (c.power === 0 && c.grade >= 1);
            if (filter === 'g4') return c.grade === 4 && !isOrder;
            if (filter === 'g3') return c.grade === 3 && !isOrder;
            if (filter === 'g2') return c.grade === 2 && !isOrder && c.trigger === 'NONE';
            if (filter === 'g1') return c.grade === 1 && !isOrder && c.trigger === 'NONE';
            if (filter === 'g0') return c.grade === 0 && c.trigger === 'NONE';
            if (filter === 'trigger') return c.trigger !== 'NONE';
            if (filter === 'order') return isOrder;
            return true;
        });

        filtered.forEach(card => {
            const item = document.createElement('div');
            item.className = 'catalog-card-item';
            item.innerHTML = `<img src="${card.image || 'img/Card/dztd01_002.webp'}" alt="${card.name}">`;
            item.title = `${card.name} (G${card.grade})`;

            item.onmouseenter = () => this.updateBuilderInspector(card);

            item.onclick = () => {
                this.addCardToEditorDeck(card);
            };

            grid.appendChild(item);
        });
    }

    handleRideSlotClick(g) {
        if (!this.editingDeck) return;
        if (this.selectedRideSlot === g) {
            this.selectedRideSlot = null;
            this.editorFilter = 'all';
            this.syncCatalogFilterButtons();
            this.renderEditorCatalog();
            this.renderDeckEditorState();
            return;
        }

        this.selectedRideSlot = g;
        // Auto filter catalog to this grade so the user immediately sees suitable cards
        this.editorFilter = g;
        this.syncCatalogFilterButtons();
        this.renderEditorCatalog();
        this.renderDeckEditorState();
    }

    syncCatalogFilterButtons() {
        document.querySelectorAll('.catalog-filter-btn').forEach(btn => {
            if (btn.dataset.filter === this.editorFilter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    addCardToEditorDeck(card) {
        if (!this.editingDeck) return;

        // 1. If user clicked a rideline box to set rideline card:
        if (this.selectedRideSlot) {
            if (card.trigger !== 'NONE') {
                alert('Kartu Trigger tidak bisa menjadi kartu Rideline Vanguard!');
                return;
            }
            if (card.grade < 0 || card.grade > 3) {
                alert(`Kartu ini Grade ${card.grade}, tidak bisa menjadi kartu Rideline (harus Grade 0 - 3)!`);
                return;
            }

            const targetSlot = 'g' + card.grade;
            this.editingDeck.rideDeck[targetSlot] = card.id;
            this.showSplash(`${targetSlot.toUpperCase()} Ride diset: ${card.name}!`, 'gold');

            // Check if there are other empty ride slots to auto-advance
            const emptySlot = ['g0', 'g1', 'g2', 'g3'].find(slot => !this.editingDeck.rideDeck[slot]);
            if (emptySlot) {
                this.selectedRideSlot = emptySlot;
                this.editorFilter = emptySlot;
                this.syncCatalogFilterButtons();
                this.renderEditorCatalog();
            } else {
                this.selectedRideSlot = null;
                this.editorFilter = 'all';
                this.syncCatalogFilterButtons();
                this.renderEditorCatalog();
            }

            this.renderDeckEditorState();
            return;
        }

        // 2. Normal Main Deck Adding
        if (this.editingDeck.mainDeckIds.length >= 50) {
            alert('Main deck sudah penuh (maksimal 50 kartu)!');
            return;
        }

        // Copy limit (max 4 per card name)
        const currentCount = this.editingDeck.mainDeckIds.filter(id => {
            const c = getCardById(id);
            return c && c.name === card.name;
        }).length;

        if (currentCount >= 4) {
            alert(`Maksimal 4 salinan kartu "${card.name}" dalam satu deck!`);
            return;
        }

        // Trigger rules
        if (card.trigger !== 'NONE') {
            const currentTriggers = this.editingDeck.mainDeckIds.filter(id => {
                const c = getCardById(id);
                return c && c.trigger !== 'NONE';
            }).length;
            if (currentTriggers >= 16) {
                alert('Maksimal 16 kartu Trigger dalam main deck!');
                return;
            }
            if (card.trigger === 'HEAL') {
                const heals = this.editingDeck.mainDeckIds.filter(id => {
                    const c = getCardById(id);
                    return c && c.trigger === 'HEAL';
                }).length;
                if (heals >= 4) {
                    alert('Maksimal 4 Heal Trigger dalam deck!');
                    return;
                }
            }
            if (card.trigger === 'OVER') {
                const overs = this.editingDeck.mainDeckIds.filter(id => {
                    const c = getCardById(id);
                    return c && c.trigger === 'OVER';
                }).length;
                if (overs >= 1) {
                    alert('Maksimal 1 Over Trigger dalam deck!');
                    return;
                }
            }
        }

        this.editingDeck.mainDeckIds.push(card.id);
        this.renderDeckEditorState();
    }

    renderDeckEditorState() {
        if (!this.editingDeck) return;

        // 1. Update Ride Deck Header Hint
        const rideHint = document.getElementById('builderRideHeaderHint');
        if (rideHint) {
            if (this.selectedRideSlot) {
                rideHint.textContent = `Memilih untuk ${this.selectedRideSlot.toUpperCase()} Ride (Klik slot lagi untuk batal)`;
                rideHint.style.color = '#38bdf8';
                rideHint.style.fontWeight = '700';
            } else {
                rideHint.textContent = 'Klik slot untuk memilih kartu Rideline';
                rideHint.style.color = '#f59e0b';
                rideHint.style.fontWeight = '400';
            }
        }

        // 2. Update Ride Deck slots
        const grades = ['g0', 'g1', 'g2', 'g3'];
        grades.forEach(g => {
            const slotEl = document.getElementById(`slotRide${g.toUpperCase()}`);
            if (!slotEl) return;
            const cardId = this.editingDeck.rideDeck[g];
            const card = cardId ? getCardById(cardId) : null;
            const isSelected = (this.selectedRideSlot === g);

            if (isSelected) {
                slotEl.classList.add('selected-target');
            } else {
                slotEl.classList.remove('selected-target');
            }

            if (card) {
                slotEl.innerHTML = `
                    <span class="slot-badge">${g.toUpperCase()} RIDE</span>
                    <button type="button" class="ride-slot-remove-btn" title="Hapus kartu ini dari Ride Deck">X</button>
                    <div class="slot-content filled">
                        <img src="${card.image || 'img/Card/dztd01_002.webp'}" alt="${card.name}">
                    </div>
                `;
                slotEl.title = isSelected
                    ? `${card.name} (Sedang dipilih untuk diganti. Klik kartu lain di katalog atau klik slot untuk batal)`
                    : `${card.name} (Klik slot untuk mengganti kartu ini)`;
                slotEl.onmouseenter = () => this.updateBuilderInspector(card);

                const delBtn = slotEl.querySelector('.ride-slot-remove-btn');
                if (delBtn) {
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.editingDeck.rideDeck[g] = null;
                        if (this.selectedRideSlot === g) this.selectedRideSlot = null;
                        this.renderDeckEditorState();
                    };
                }
                slotEl.onclick = () => {
                    this.handleRideSlotClick(g);
                };
            } else {
                slotEl.innerHTML = `
                    <span class="slot-badge">${g.toUpperCase()} RIDE</span>
                    <div class="slot-content empty ${isSelected ? 'active-target-text' : ''}">
                        ${isSelected ? 'PILIH KARTU' : `+ ${g.toUpperCase()} Slot`}
                    </div>
                `;
                slotEl.title = `Klik untuk memilih kartu ${g.toUpperCase()} Rideline dari katalog.`;
                slotEl.onmouseenter = null;
                slotEl.onclick = () => {
                    this.handleRideSlotClick(g);
                };
            }
        });

        // Crest slot
        const crestSlot = document.getElementById('slotRideCrest');
        if (crestSlot) {
            crestSlot.onmouseenter = () => this.updateBuilderInspector(getCardById('dz_005'));
        }

        // 3. Update Main Deck (Separated into Normal Unit & Order vs Trigger Unit)
        const emptyNotice = document.getElementById('mainDeckEmptyNotice');
        const secNormal = document.getElementById('sectionNormalUnits');
        const secTrigger = document.getElementById('sectionTriggerUnits');
        const normalGrid = document.getElementById('builderNormalDeckGrid');
        const triggerGrid = document.getElementById('builderTriggerDeckGrid');
        const countNormalEl = document.getElementById('countNormalUnits');
        const countTriggerEl = document.getElementById('countTriggerUnits');
        const breakdownEl = document.getElementById('deckTriggerPillBreakdown');

        if (this.editingDeck.mainDeckIds.length === 0) {
            if (emptyNotice) emptyNotice.style.display = 'flex';
            if (secNormal) secNormal.style.display = 'none';
            if (secTrigger) secTrigger.style.display = 'none';
        } else {
            if (emptyNotice) emptyNotice.style.display = 'none';
            if (secNormal) secNormal.style.display = 'block';
            if (secTrigger) secTrigger.style.display = 'block';

            const counts = {};
            this.editingDeck.mainDeckIds.forEach(id => {
                counts[id] = (counts[id] || 0) + 1;
            });

            const uniqueIds = Object.keys(counts);
            const normalIds = [];
            const triggerIds = [];

            let normalCount = 0;
            let triggerCount = 0;
            let critCount = 0, drawCount = 0, frontCount = 0, healCount = 0, overCount = 0;

            uniqueIds.forEach(id => {
                const c = getCardById(id);
                if (!c) return;
                const count = counts[id];
                if (c.trigger && c.trigger !== 'NONE') {
                    triggerIds.push(id);
                    triggerCount += count;
                    if (c.trigger === 'CRITICAL') critCount += count;
                    else if (c.trigger === 'DRAW') drawCount += count;
                    else if (c.trigger === 'FRONT') frontCount += count;
                    else if (c.trigger === 'HEAL') healCount += count;
                    else if (c.trigger === 'OVER') overCount += count;
                } else {
                    normalIds.push(id);
                    normalCount += count;
                }
            });

            // Update Counts & Breakdown
            if (countNormalEl) countNormalEl.textContent = `${normalCount} / 34 Kartu`;
            if (countTriggerEl) countTriggerEl.textContent = `${triggerCount} / 16 Trigger`;
            if (breakdownEl) {
                breakdownEl.innerHTML = `
                    <span class="trg-mini crit" title="Critical Trigger">CRIT: ${critCount}</span>
                    <span class="trg-mini draw" title="Draw Trigger">DRAW: ${drawCount}</span>
                    <span class="trg-mini front" title="Front Trigger">FRONT: ${frontCount}</span>
                    <span class="trg-mini heal" title="Heal Trigger">HEAL: ${healCount}/4</span>
                    <span class="trg-mini over" title="Over Trigger">OVER: ${overCount}/1</span>
                `;
            }

            // Sort Normal Units & Orders (Grade 3 -> Grade 2 -> Grade 1 -> Order, then name)
            normalIds.sort((a, b) => {
                const ca = getCardById(a);
                const cb = getCardById(b);
                if (!ca || !cb) return 0;
                if (cb.grade !== ca.grade) return cb.grade - ca.grade;
                return ca.name.localeCompare(cb.name);
            });

            // Sort Trigger Units (Critical -> Front -> Draw -> Heal -> Over, then name)
            const trgPriority = { 'CRITICAL': 1, 'FRONT': 2, 'DRAW': 3, 'HEAL': 4, 'OVER': 5 };
            triggerIds.sort((a, b) => {
                const ca = getCardById(a);
                const cb = getCardById(b);
                if (!ca || !cb) return 0;
                const pa = trgPriority[ca.trigger] || 9;
                const pb = trgPriority[cb.trigger] || 9;
                if (pa !== pb) return pa - pb;
                return ca.name.localeCompare(cb.name);
            });

            const renderCardListIntoGrid = (ids, gridEl) => {
                if (!gridEl) return;
                gridEl.innerHTML = '';
                if (ids.length === 0) {
                    gridEl.innerHTML = '<div style="color:#64748b;font-size:11px;font-style:italic;padding:8px;grid-column:1/-1;">Belum ada kartu di bagian ini.</div>';
                    return;
                }
                ids.forEach(id => {
                    const c = getCardById(id);
                    if (!c) return;
                    const count = counts[id];
                    const item = document.createElement('div');
                    item.className = 'deck-preview-card-item';
                    item.innerHTML = `
                        <img src="${c.image || 'img/Card/dztd01_002.webp'}" alt="${c.name}">
                        <span class="badge-card-count">x${count}</span>
                    `;
                    item.title = `${c.name} (x${count}) - Klik untuk menghapus 1 salinan`;

                    item.onmouseenter = () => this.updateBuilderInspector(c);

                    item.onclick = () => {
                        const idx = this.editingDeck.mainDeckIds.indexOf(id);
                        if (idx !== -1) {
                            this.editingDeck.mainDeckIds.splice(idx, 1);
                            this.renderDeckEditorState();
                        }
                    };

                    gridEl.appendChild(item);
                });
            };

            renderCardListIntoGrid(normalIds, normalGrid);
            renderCardListIntoGrid(triggerIds, triggerGrid);
        }

        // 3. Update Status Counters
        const mainCount = this.editingDeck.mainDeckIds.length;
        let rideCount = 1; // Crest is always 1
        ['g0', 'g1', 'g2', 'g3'].forEach(g => {
            if (this.editingDeck.rideDeck[g]) rideCount++;
        });

        let trgCount = 0, healCount = 0, overCount = 0;
        this.editingDeck.mainDeckIds.forEach(id => {
            const c = getCardById(id);
            if (c) {
                if (c.trigger !== 'NONE') trgCount++;
                if (c.trigger === 'HEAL') healCount++;
                if (c.trigger === 'OVER') overCount++;
            }
        });

        const statDeck = document.getElementById('statDeckTotal');
        const statRide = document.getElementById('statRideTotal');
        const statTrg = document.getElementById('statTriggerTotal');
        const statHeal = document.getElementById('statHealTotal');
        const statOver = document.getElementById('statOverTotal');

        if (statDeck) statDeck.textContent = mainCount;
        if (statRide) statRide.textContent = rideCount;
        if (statTrg) statTrg.textContent = trgCount;
        if (statHeal) statHeal.textContent = healCount;
        if (statOver) statOver.textContent = overCount;
    }

    saveCurrentEditingDeck() {
        if (!this.editingDeck) return;
        const nameInput = document.getElementById('inputDeckName');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            alert('Silakan masukkan nama deck!');
            return;
        }
        this.editingDeck.name = name;

        // Validation
        const r = this.editingDeck.rideDeck;
        if (!r.g0 || !r.g1 || !r.g2 || !r.g3) {
            alert('Ride Deck belum lengkap! Harus memiliki 1x G0, 1x G1, 1x G2, dan 1x G3.');
            return;
        }

        if (this.editingDeck.mainDeckIds.length !== 50) {
            alert(`Main Deck harus berisi tepat 50 kartu! (Saat ini: ${this.editingDeck.mainDeckIds.length} kartu)`);
            return;
        }

        let trgCount = 0;
        this.editingDeck.mainDeckIds.forEach(id => {
            const c = getCardById(id);
            if (c && c.trigger !== 'NONE') trgCount++;
        });
        if (trgCount !== 16) {
            alert(`Main Deck harus berisi tepat 16 kartu Trigger! (Saat ini: ${trgCount} trigger)`);
            return;
        }

        // Construct final deck object
        const rideDeckIds = [r.g0, r.g1, r.g2, r.g3, r.crest || 'dz_005'];
        const savedDeck = {
            id: this.editingDeck.id,
            name: this.editingDeck.name,
            nation: this.editingDeck.nation,
            rideDeckIds,
            mainDeckIds: this.editingDeck.mainDeckIds
        };

        saveDeckToStorage(savedDeck);
        setActiveDeckId(savedDeck.id);
        this.selectedDeckKey = savedDeck.id;
        this.closeDeckEditor();
        this.showSplash(`Deck "${savedDeck.name}" berhasil disimpan!`, 'gold');
    }

    compileEditingDeckObject() {
        if (!this.editingDeck) return null;
        const nameInput = document.getElementById('inputDeckName');
        const name = (nameInput ? nameInput.value.trim() : '') || this.editingDeck.name || 'Custom Deck';
        const r = this.editingDeck.rideDeck || {};
        const rideDeckIds = [r.g0, r.g1, r.g2, r.g3, r.crest || 'dz_005'].filter(Boolean);
        return {
            id: this.editingDeck.id || ('deck_' + Date.now()),
            name: name,
            nation: this.editingDeck.nation || 'Dragon Empire',
            rideDeckIds: rideDeckIds,
            mainDeckIds: [...(this.editingDeck.mainDeckIds || [])]
        };
    }

    exportDeckToJson(deck) {
        if (!deck) return;
        const exportData = {
            id: deck.id,
            name: deck.name,
            nation: deck.nation || 'Dragon Empire',
            rideDeckIds: deck.rideDeckIds || [],
            mainDeckIds: deck.mainDeckIds || [],
            exportedAt: new Date().toISOString()
        };
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = (deck.name || 'vanguard_deck').toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '.json';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showSplash(`Deck "${deck.name}" berhasil diekspor sebagai ${filename}!`, 'gold');
    }

    importDeckFromJson(data) {
        if (!data || typeof data !== 'object') {
            alert('File JSON tidak valid!');
            return;
        }
        let deckList = [];
        if (data.id && (data.mainDeckIds || data.rideDeckIds)) {
            deckList = [data];
        } else {
            deckList = Object.values(data).filter(d => d && typeof d === 'object' && d.id);
        }

        if (deckList.length === 0) {
            alert('Tidak ditemukan data deck yang valid dalam file JSON!');
            return;
        }

        let importedCount = 0;
        let lastId = null;
        deckList.forEach(deck => {
            if (!deck.id) deck.id = 'deck_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            if (!deck.name) deck.name = 'Imported Deck';
            if (!Array.isArray(deck.rideDeckIds)) deck.rideDeckIds = [];
            if (!Array.isArray(deck.mainDeckIds)) deck.mainDeckIds = [];
            saveDeckToStorage(deck);
            lastId = deck.id;
            importedCount++;
        });

        if (lastId) {
            this.selectedDeckKey = lastId;
            setActiveDeckId(lastId);
        }
        this.renderDeckManager();
        this.showSplash(`${importedCount} deck berhasil diimpor!`, 'gold');
    }

    getVanguardCrestSVG() {
        return `
            <svg class="crest-svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" stroke="#06b6d4" stroke-width="2" fill="rgba(6, 182, 212, 0.08)" stroke-dasharray="6 3" />
                <circle cx="50" cy="50" r="34" stroke="#06b6d4" stroke-width="1.5" fill="none" />
                <polygon points="50,20 60,40 82,40 64,54 71,76 50,62 29,76 36,54 18,40 40,40" stroke="#06b6d4" stroke-width="1.2" fill="none" opacity="0.6"/>
                <text x="50" y="58" font-size="28" font-weight="900" fill="#06b6d4" text-anchor="middle" font-family="'Outfit', sans-serif">V</text>
            </svg>
        `;
    }

    getRearguardCrestSVG() {
        return `
            <svg class="crest-svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" stroke="#f59e0b" stroke-width="2" fill="rgba(245, 158, 11, 0.06)" stroke-dasharray="4 2" />
                <circle cx="50" cy="50" r="34" stroke="#f59e0b" stroke-width="1.2" fill="none" />
                <circle cx="50" cy="50" r="24" stroke="#f59e0b" stroke-width="1" stroke-dasharray="2 2" fill="none" opacity="0.5"/>
                <text x="50" y="58" font-size="26" font-weight="900" fill="#f59e0b" text-anchor="middle" font-family="'Outfit', sans-serif">R</text>
            </svg>
        `;
    }

    onPeerConnected(peerId) {
        if (this.network && this.network.isHost) {
            this.elModal.style.display = 'none';
            this.showView('viewGamePlay');
            this.viewPerspective = 1;
            const hostDeckKey = this.selectedP1DeckKey || ((typeof getActiveDeckId === 'function') ? (getActiveDeckId() || 'varga_dragres') : 'varga_dragres');
            const guestDeckKey = this.selectedP2DeckKey || 'bastion_sanctuary';
            this.startNewMatch(hostDeckKey, guestDeckKey);
            this.network.isOnline = true;
            this.network.isHost = true;
            this.network.myPlayerId = 1;

            this.network.sendAction('MATCH_START', {
                state: this.engine.getState(),
                hostDeckKey: hostDeckKey,
                guestDeckKey: guestDeckKey
            });
        }
    }

    onNetworkAction(data) {
        if (!data || !data.actionType) return;

        if (data.actionType === 'CHAT') {
            this.addChatMessage(data.payload.sender, data.payload.text, data.payload.cls);
            return;
        }

        if (data.actionType === 'PLAYER_HELLO') {
            if (this.network && this.network.isHost) {
                if (data.payload && data.payload.deckKey) {
                    this.selectedP2DeckKey = data.payload.deckKey;
                }
                const hostDeckKey = this.selectedP1DeckKey || ((typeof getActiveDeckId === 'function') ? (getActiveDeckId() || 'varga_dragres') : 'varga_dragres');
                const guestDeckKey = this.selectedP2DeckKey || 'bastion_sanctuary';
                this.startNewMatch(hostDeckKey, guestDeckKey);
                this.network.isOnline = true;
                this.network.isHost = true;
                this.network.myPlayerId = 1;
                this.viewPerspective = 1;

                this.network.sendAction('MATCH_START', {
                    state: this.engine.getState(),
                    hostDeckKey: hostDeckKey,
                    guestDeckKey: guestDeckKey
                });
            }
            return;
        }

        if (data.actionType === 'MATCH_START') {
            this.elModal.style.display = 'none';
            this.showView('viewGamePlay');
            this.network.isOnline = true;
            this.network.isHost = false;
            this.network.myPlayerId = 2;
            this.viewPerspective = 2;

            this.engine.loadState(data.payload.state);
            this.renderAll();
            this.showDiceRollModal();
            return;
        }

        if (data.actionType === 'SYNC_STATE') {
            this.engine.loadState(data.payload.state);
            this.handleEngineEvent(data.payload.eventType, data.payload.payload);
            return;
        }

        if (data.actionType === 'CLIENT_ACTION') {
            if (this.network && this.network.isHost) {
                this.handleClientAction(data.payload);
            }
            return;
        }
    }

    dispatchAction(actionName, payload = {}) {
        if (this.network && this.network.isOnline && !this.network.isHost) {
            this.network.sendAction('CLIENT_ACTION', { action: actionName, payload });
            return true;
        }
        return false;
    }

    handleClientAction(clientPayload) {
        if (!clientPayload || !this.engine) return;
        const { action, payload } = clientPayload;

        switch (action) {
            case 'MULLIGAN':
                this.engine.performMulligan(2, payload.indices || []);
                break;
            case 'CHOOSE_TURN_ORDER':
                this.engine.chooseTurnOrder(payload.chosenPlayerNum);
                break;
            case 'PHASE_BUTTON':
                this.handleActionPhaseBtn();
                break;
            case 'END_TURN':
                this.handleEndTurn();
                break;
            case 'CALL_UNIT':
                this.engine.callUnit(payload.handIndex, payload.circleKey);
                break;
            case 'MOVE_UNIT':
                this.engine.moveOrSwapRearGuard(payload.fromKey, payload.toKey);
                break;
            case 'RIDE_FROM_HAND':
                this.engine.rideFromHand(payload.handIndex);
                break;
            case 'RIDE_FROM_RIDE_DECK':
                this.engine.rideFromRideDeck(payload.rideDeckIndex, payload.discardHandIndex);
                this.engine.proceedToMainPhase();
                break;
            case 'SKIP_RIDE':
                this.engine.skipRide();
                break;
            case 'DECLARE_ATTACK':
                this.engine.declareAttack(payload.attackerKey, payload.targetKey, payload.boosterKey);
                break;
            case 'CALL_GUARDIAN':
                this.engine.callGuardian(payload.handIndex);
                break;
            case 'FINISH_GUARD':
                this.engine.finishGuardStep();
                break;
            case 'TRIUMPH_ACT':
                this.engine.executeTriumphAct(this.engine.p2, payload.targetCardId);
                break;
            case 'TRIUMPH_AUTO':
                this.engine.activateTriumphAuto(payload.retireCircleKey);
                break;
            case 'SKIP_ATTACK_ABILITY':
                this.engine.skipAttackAbility();
                break;
            case 'SELECT_TRIGGER_POWER':
                this.engine.applyTriggerPower(this.engine.p2, payload.circleKey, payload.amount || 10000);
                break;
            case 'SELECT_TRIGGER_CRIT':
                this.engine.applyTriggerCritical(this.engine.p2, payload.circleKey, payload.amount || 1);
                break;
        }
    }

    // =========================================================
    // CARD DATABASE & EFFECT MANAGER (ADMIN CRUD)
    // =========================================================
    initCardAdminUI() {
        if (this._adminInitialized) {
            this.renderAdminCardList();
            return;
        }
        this._adminInitialized = true;

        // Search Input
        const searchInput = document.getElementById('adminCardSearchInput');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.adminSearchTerm = e.target.value.toLowerCase().trim();
                this.renderAdminCardList();
            };
        }

        // Nation Filters
        document.querySelectorAll('#adminNationFilterGroup .filter-chip').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#adminNationFilterGroup .filter-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.adminFilterNation = btn.dataset.nation || 'all';
                this.renderAdminCardList();
            };
        });

        // Category Filters
        document.querySelectorAll('#adminCategoryFilterGroup .filter-chip').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#adminCategoryFilterGroup .filter-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.adminFilterCategory = btn.dataset.category || 'all';
                this.renderAdminCardList();
            };
        });

        // Grade Filters
        document.querySelectorAll('#adminGradeFilterGroup .filter-chip').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#adminGradeFilterGroup .filter-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.adminFilterGrade = btn.dataset.grade || 'all';
                this.renderAdminCardList();
            };
        });

        // Category & Trigger Dynamic Sync in Form
        const catSelect = document.getElementById('adminInputType');
        const triggerSelect = document.getElementById('adminInputTrigger');
        const gradeSelect = document.getElementById('adminInputGrade');

        const updateFormBadge = () => {
            const pBadge = document.getElementById('adminFormPreviewBadge');
            if (!pBadge) return;
            const cat = catSelect ? catSelect.value : 'Normal Unit';
            const gr = gradeSelect ? gradeSelect.value : '3';
            const trg = triggerSelect ? triggerSelect.value : 'NONE';
            if (cat === 'Crest') pBadge.textContent = 'Crest';
            else if (cat === 'Trigger Unit') pBadge.textContent = `${trg} Trigger`;
            else if (cat === 'Token') pBadge.textContent = `Token Unit`;
            else pBadge.textContent = `G${gr} ${cat}`;
        };

        if (catSelect) {
            catSelect.onchange = () => {
                const cat = catSelect.value;
                const pInput = document.getElementById('adminInputPower');
                const sInput = document.getElementById('adminInputShield');
                const gInput = document.getElementById('adminInputGrade');

                if (cat === 'Trigger Unit') {
                    if (triggerSelect && triggerSelect.value === 'NONE') triggerSelect.value = 'CRITICAL';
                    if (gInput) gInput.value = '0';
                    if (pInput && (Number(pInput.value) === 0 || Number(pInput.value) > 10000)) pInput.value = 5000;
                    if (sInput && Number(sInput.value) === 0) sInput.value = 10000;
                    const b = document.getElementById('adminSkillBoost');
                    if (b) b.checked = true;
                } else if (cat === 'Normal Unit') {
                    if (triggerSelect) triggerSelect.value = 'NONE';
                    if (gInput && gInput.value === '0') gInput.value = '3';
                    if (pInput && Number(pInput.value) <= 5000) pInput.value = 13000;
                } else if (['Normal Order', 'Set Order', 'Blitz Order'].includes(cat)) {
                    if (triggerSelect) triggerSelect.value = 'NONE';
                    if (pInput) pInput.value = 0;
                    if (cat !== 'Blitz Order' && sInput) sInput.value = 0;
                    ['Boost', 'Intercept', 'TwinDrive', 'TripleDrive', 'Sentinel'].forEach(s => {
                        const el = document.getElementById(`adminSkill${s}`);
                        if (el) el.checked = false;
                    });
                } else if (cat === 'Token') {
                    if (triggerSelect) triggerSelect.value = 'NONE';
                    if (pInput && Number(pInput.value) === 0) pInput.value = 5000;
                } else if (cat === 'Crest') {
                    if (triggerSelect) triggerSelect.value = 'NONE';
                    if (gInput) gInput.value = '0';
                    if (pInput) pInput.value = 0;
                    if (sInput) sInput.value = 0;
                    ['Boost', 'Intercept', 'TwinDrive', 'TripleDrive', 'Sentinel'].forEach(s => {
                        const el = document.getElementById(`adminSkill${s}`);
                        if (el) el.checked = false;
                    });
                }
                updateFormBadge();
            };
        }

        if (triggerSelect) {
            triggerSelect.onchange = () => {
                if (triggerSelect.value !== 'NONE') {
                    if (catSelect) catSelect.value = 'Trigger Unit';
                    const gInput = document.getElementById('adminInputGrade');
                    if (gInput) gInput.value = '0';
                    const sInput = document.getElementById('adminInputShield');
                    if (sInput && Number(sInput.value) === 0) {
                        if (triggerSelect.value === 'HEAL') sInput.value = 15000;
                        else if (triggerSelect.value === 'DRAW') sInput.value = 5000;
                        else if (triggerSelect.value === 'OVER') sInput.value = 50000;
                        else sInput.value = 10000;
                    }
                } else {
                    if (catSelect && catSelect.value === 'Trigger Unit') {
                        catSelect.value = 'Normal Unit';
                    }
                }
                updateFormBadge();
            };
        }

        if (gradeSelect) gradeSelect.onchange = updateFormBadge;

        // Setup Quick Image Chips
        this.setupAdminQuickImagePicker();

        // Image Preview & Auto-WebP File Upload Handler
        const imgInput = document.getElementById('adminInputImage');
        const testImgBtn = document.getElementById('btnAdminTestImage');
        const fileInput = document.getElementById('adminInputImageFile');
        const uploadBtn = document.getElementById('btnAdminUploadFile');
        const dropzone = document.getElementById('adminImageDropzone');
        const headerArtBox = document.getElementById('adminHeaderArtPreviewBox');
        const progress = document.getElementById('adminUploadProgress');

        const updateArt = () => {
            const preview = document.getElementById('adminFormPreviewArt');
            if (preview && imgInput) {
                preview.src = imgInput.value.trim() || 'img/Card/dztd01_002.webp';
            }
        };
        if (imgInput) imgInput.oninput = updateArt;
        if (testImgBtn) testImgBtn.onclick = updateArt;

        const processSelectedFile = (file) => {
            if (!file) return;
            if (progress) {
                progress.style.display = 'block';
                progress.style.color = '#38bdf8';
                progress.textContent = `Sedang membaca "${file.name}" & mengonversi ke WebP...`;
            }

            this.convertImageFileToWebP(file)
                .then(async res => {
                    const idInput = document.getElementById('adminInputId');
                    const cardId = idInput ? idInput.value.trim() : '';

                    // Upload to upload_card_image.php to write directly into img/Card/ folder on disk
                    let savedServerPath = null;
                    try {
                        const uploadRes = await fetch('upload_card_image.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                dataUrl: res.dataUrl,
                                filename: file.name,
                                cardId: cardId || ('card_' + Date.now())
                            })
                        });
                        if (uploadRes.ok) {
                            const upData = await uploadRes.json();
                            if (upData && upData.path) {
                                savedServerPath = upData.path;
                            }
                        }
                    } catch (netErr) {
                        // Fallback silently if offline or on static host
                    }

                    const finalImgPath = savedServerPath || res.dataUrl;
                    if (imgInput) imgInput.value = finalImgPath;

                    const preview = document.getElementById('adminFormPreviewArt');
                    if (preview) preview.src = finalImgPath;

                    if (progress) {
                        const origKb = (file.size / 1024).toFixed(1);
                        const newKb = (res.sizeBytes / 1024).toFixed(1);
                        progress.style.color = '#10b981';
                        if (savedServerPath) {
                            progress.textContent = `Tersimpan ke folder "${savedServerPath}"! (${origKb} KB -> ${newKb} KB)`;
                        } else {
                            progress.textContent = `Berhasil dikonversi ke WebP! (${origKb} KB -> ${newKb} KB)`;
                        }
                    }
                    this.showSplash(savedServerPath ? `Foto kartu disimpan ke ${savedServerPath}!` : 'Gambar berhasil dikonversi ke format WebP!', 'emerald');
                })
                .catch(err => {
                    console.error('WebP conversion failed:', err);
                    if (progress) {
                        progress.style.color = '#ef4444';
                        progress.textContent = `Gagal mengonversi gambar: ${err.message}`;
                    }
                });
        };

        if (uploadBtn && fileInput) {
            uploadBtn.onclick = (e) => {
                e.stopPropagation();
                fileInput.click();
            };
        }

        if (dropzone && fileInput) {
            dropzone.onclick = () => fileInput.click();
            ['dragenter', 'dragover'].forEach(evt => {
                dropzone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.add('dragover');
                });
            });
            ['dragleave', 'dragend', 'drop'].forEach(evt => {
                dropzone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('dragover');
                });
            });
            dropzone.addEventListener('drop', (e) => {
                const files = e.dataTransfer && e.dataTransfer.files;
                if (files && files.length > 0) {
                    processSelectedFile(files[0]);
                }
            });
        }

        if (headerArtBox && fileInput) {
            headerArtBox.onclick = () => fileInput.click();
        }

        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) processSelectedFile(file);
            };
        }

        // Ability text live formatting preview
        const abilityInput = document.getElementById('adminInputAbility');
        if (abilityInput) {
            abilityInput.oninput = () => {
                const livePreview = document.getElementById('adminAbilityLivePreview');
                if (livePreview) {
                    livePreview.innerHTML = this.formatAbilityText(abilityInput.value);
                }
            };
        }

        // Buttons
        const safeClick = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        };
        safeClick('btnAdminAddNewCard', () => this.resetAdminForm());
        safeClick('btnAdminResetForm', () => this.resetAdminForm());
        safeClick('btnAdminSaveCard', () => this.saveAdminCardFromForm());
        safeClick('btnAdminDuplicateCard', () => this.duplicateAdminCard());
        safeClick('btnAdminDeleteCard', () => this.deleteAdminCurrentCard());
        safeClick('btnAdminDeleteCardHeader', () => this.deleteAdminCurrentCard());
        safeClick('btnAdminExport', () => this.showAdminExportModal());
        safeClick('btnAdminImport', () => this.showAdminImportModal());
        safeClick('btnAdminResetDefault', () => {
            if (confirm('Reset semua kartu ke katalog bawaan default? Semua kartu kustom dan perubahan stats akan dihapus.')) {
                resetCardsDataToDefault();
                this.renderAdminCardList();
                this.resetAdminForm();
                this.showSplash('Katalog kartu berhasil direset ke default!', 'gold');
            }
        });

        this.renderAdminCardList();
        this.resetAdminForm();
    }

    setupAdminQuickImagePicker() {
        const picker = document.getElementById('adminQuickImgPicker');
        if (!picker) return;
        picker.innerHTML = '';
        for (let i = 1; i <= 17; i++) {
            const numStr = String(i).padStart(3, '0');
            const file = `dztd01_${numStr}.webp`;
            const chip = document.createElement('span');
            chip.className = 'quick-img-chip';
            chip.textContent = file;
            chip.onclick = () => {
                const input = document.getElementById('adminInputImage');
                if (input) {
                    input.value = `img/Card/${file}`;
                    const preview = document.getElementById('adminFormPreviewArt');
                    if (preview) preview.src = input.value;
                }
            };
            picker.appendChild(chip);
        }
    }

    convertImageFileToWebP(file, maxWidth = 500, quality = 0.90) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error('File tidak valid'));
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Standard card proportion scaling if too big
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const webpDataUrl = canvas.toDataURL('image/webp', quality);
                    const approxBytes = Math.round(webpDataUrl.length * 0.75);

                    resolve({
                        dataUrl: webpDataUrl,
                        originalName: file.name,
                        sizeBytes: approxBytes,
                        width,
                        height
                    });
                };
                img.onerror = () => reject(new Error('Gagal memproses file gambar'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Gagal membaca file'));
            reader.readAsDataURL(file);
        });
    }

    renderAdminCardList() {
        const container = document.getElementById('adminCardsListBox');
        if (!container) return;
        container.innerHTML = '';

        const badge = document.getElementById('adminCardsTotalBadge');
        if (badge) {
            badge.textContent = `Total: ${CARD_CATALOG.length} Kartu`;
        }

        const filtered = CARD_CATALOG.filter(c => {
            // Search text
            if (this.adminSearchTerm) {
                const term = this.adminSearchTerm;
                const matchName = (c.name || '').toLowerCase().includes(term);
                const matchId = (c.id || '').toLowerCase().includes(term);
                if (!matchName && !matchId) return false;
            }

            // Nation filter
            if (this.adminFilterNation && this.adminFilterNation !== 'all') {
                const filterIsCe = typeof isCrayElementalNation === 'function' && isCrayElementalNation(this.adminFilterNation);
                if (filterIsCe) {
                    if (!isCrayElementalNation(c.nation)) return false;
                } else if (c.nation !== this.adminFilterNation) {
                    return false;
                }
            }

            // Category filter
            const cat = getCardCategory(c);
            if (this.adminFilterCategory && this.adminFilterCategory !== 'all') {
                if (cat !== this.adminFilterCategory) return false;
            }

            // Grade filter
            if (this.adminFilterGrade && this.adminFilterGrade !== 'all') {
                if (String(c.grade) !== this.adminFilterGrade) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div style="color:#64748b;font-size:12px;text-align:center;padding:30px;">Tidak ada kartu yang cocok dengan filter.</div>';
            return;
        }

        filtered.forEach(c => {
            const item = document.createElement('div');
            item.className = `admin-card-row-item ${this.adminSelectedCardId === c.id ? 'selected' : ''}`;
            
            const cat = getCardCategory(c);
            let catBadgeClass = 'normal-unit';
            if (cat === 'Trigger Unit') catBadgeClass = 'trigger-unit';
            else if (cat === 'Normal Order') catBadgeClass = 'normal-order';
            else if (cat === 'Set Order') catBadgeClass = 'set-order';
            else if (cat === 'Blitz Order') catBadgeClass = 'blitz-order';
            else if (cat === 'Token') catBadgeClass = 'token';
            else if (cat === 'Crest') catBadgeClass = 'crest';

            let typeDisplay = cat === 'Crest' ? 'Crest' : (cat === 'Trigger Unit' ? `${c.trigger} Trigger` : (cat === 'Token' ? 'Token Unit' : `G${c.grade} ${cat}`));

            item.innerHTML = `
                <img src="${c.image || 'img/Card/dztd01_002.webp'}" class="admin-card-thumb-mini" alt="${c.name}">
                <div class="admin-card-meta-left">
                    <div class="admin-card-name-txt">${c.name}</div>
                    <div class="admin-card-sub-txt">
                        <span>[${c.id}]</span>
                        <span>•</span>
                        <span>${c.nation}${(typeof isCrayElementalNation === 'function' && isCrayElementalNation(c.nation)) ? ' (Universal)' : ''}</span>
                        <span>•</span>
                        <span class="admin-card-badge ${catBadgeClass}">${typeDisplay}</span>
                    </div>
                </div>
                <div style="font-size:11px;font-weight:700;color:#38bdf8;text-align:right;white-space:nowrap;margin-right:2px;">
                    ${(c.power || c.basePower || 0).toLocaleString()} Pow
                </div>
                <button type="button" class="btn-card-del-direct" title="Hapus kartu ${c.name} dari database">
                    Hapus
                </button>
            `;

            const delRowBtn = item.querySelector('.btn-card-del-direct');
            if (delRowBtn) {
                delRowBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`Yakin ingin menghapus kartu "${c.name}" [${c.id}] dari database?`)) {
                        deleteCardFromDatabase(c.id);
                        if (this.adminSelectedCardId === c.id) {
                            this.resetAdminForm();
                        }
                        this.renderAdminCardList();
                        this.showSplash(`Kartu "${c.name}" berhasil dihapus dari database.`, 'gold');
                    }
                };
            }

            item.onclick = () => this.loadCardIntoAdminForm(c);
            container.appendChild(item);
        });
    }

    loadCardIntoAdminForm(card) {
        if (!card) return;
        this.adminSelectedCardId = card.id;

        const setTitle = document.getElementById('adminFormTitle');
        if (setTitle) setTitle.textContent = `Edit Kartu: ${card.name} (${card.id})`;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val !== undefined ? val : '';
        };

        const cat = getCardCategory(card);

        setVal('adminInputId', card.id);
        setVal('adminInputName', card.name);
        const nationVal = (typeof isCrayElementalNation === 'function' && isCrayElementalNation(card.nation)) ? 'Cray Elemental' : (card.nation || 'Dragon Empire');
        setVal('adminInputNation', nationVal);
        setVal('adminInputType', cat);
        setVal('adminInputGrade', card.grade !== undefined ? card.grade : 3);
        setVal('adminInputPower', card.power !== undefined ? card.power : (card.basePower || 0));
        setVal('adminInputShield', card.shield !== undefined ? card.shield : (card.baseShield || 0));
        setVal('adminInputCrit', card.critical !== undefined ? card.critical : (card.baseCritical || 1));
        setVal('adminInputTrigger', card.trigger || 'NONE');
        setVal('adminInputImage', card.image || '');
        setVal('adminInputAbility', card.ability || '');
        setVal('adminInputEffectScript', card.effectScript || '');

        // Skills checkboxes
        const skills = Array.isArray(card.skill) ? card.skill : [];
        ['Boost', 'Intercept', 'TwinDrive', 'TripleDrive', 'Sentinel'].forEach(s => {
            const chk = document.getElementById(`adminSkill${s}`);
            if (chk) {
                const val = chk.value;
                chk.checked = skills.includes(val);
            }
        });

        // Preview
        const preview = document.getElementById('adminFormPreviewArt');
        if (preview) preview.src = card.image || 'img/Card/dztd01_002.webp';

        const pBadge = document.getElementById('adminFormPreviewBadge');
        if (pBadge) {
            let badgeText = cat === 'Crest' ? 'Crest' : (cat === 'Trigger Unit' ? `${card.trigger} Trigger` : (cat === 'Token' ? 'Token Unit' : `G${card.grade} ${cat}`));
            pBadge.textContent = badgeText;
        }

        const livePreview = document.getElementById('adminAbilityLivePreview');
        if (livePreview) livePreview.innerHTML = this.formatAbilityText(card.ability);

        // Delete button visibility - ANY card in database can be deleted
        const delBtn = document.getElementById('btnAdminDeleteCard');
        if (delBtn) {
            delBtn.style.display = 'inline-flex';
            delBtn.innerHTML = `Hapus Kartu Ini (${card.id})`;
        }
        const delHeaderBtn = document.getElementById('btnAdminDeleteCardHeader');
        if (delHeaderBtn) {
            delHeaderBtn.style.display = 'inline-flex';
            delHeaderBtn.innerHTML = `Hapus Kartu Ini`;
        }

        const progress = document.getElementById('adminUploadProgress');
        if (progress) {
            progress.style.display = 'none';
            progress.textContent = '';
        }

        // Highlight in list
        document.querySelectorAll('.admin-card-row-item').forEach(el => el.classList.remove('selected'));
        const container = document.getElementById('adminCardsListBox');
        if (container) {
            const items = container.querySelectorAll('.admin-card-row-item');
            items.forEach(it => {
                if (it.textContent.includes(`[${card.id}]`)) {
                    it.classList.add('selected');
                }
            });
        }
    }

    resetAdminForm() {
        this.adminSelectedCardId = null;
        const setTitle = document.getElementById('adminFormTitle');
        if (setTitle) setTitle.textContent = 'Tambah Kartu Baru';

        const newId = `dz_${Math.random().toString(36).substring(2, 6)}`;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('adminInputId', newId);
        setVal('adminInputName', '');
        setVal('adminInputNation', 'Dragon Empire');
        setVal('adminInputType', 'Normal Unit');
        setVal('adminInputGrade', 3);
        setVal('adminInputPower', 13000);
        setVal('adminInputShield', 0);
        setVal('adminInputCrit', 1);
        setVal('adminInputTrigger', 'NONE');
        setVal('adminInputImage', 'img/Card/dztd01_002.webp');
        setVal('adminInputAbility', '');
        setVal('adminInputEffectScript', '// Tuliskan kode / logic efek kartu di sini\n// onAttack(engine, card) { ... }\n// onPlaced(engine, card) { ... }');

        // Skills checkboxes default
        ['Boost', 'Intercept', 'TripleDrive', 'Sentinel'].forEach(s => {
            const chk = document.getElementById(`adminSkill${s}`);
            if (chk) chk.checked = false;
        });
        const td = document.getElementById('adminSkillTwinDrive');
        if (td) td.checked = true;

        const preview = document.getElementById('adminFormPreviewArt');
        if (preview) preview.src = 'img/Card/dztd01_002.webp';

        const pBadge = document.getElementById('adminFormPreviewBadge');
        if (pBadge) pBadge.textContent = 'G3 Normal Unit';

        const livePreview = document.getElementById('adminAbilityLivePreview');
        if (livePreview) livePreview.innerHTML = '<div style="color:#64748b;font-size:11px;">Belum ada teks efek.</div>';

        const delBtn = document.getElementById('btnAdminDeleteCard');
        if (delBtn) delBtn.style.display = 'none';
        const delHeaderBtn = document.getElementById('btnAdminDeleteCardHeader');
        if (delHeaderBtn) delHeaderBtn.style.display = 'none';

        const progress = document.getElementById('adminUploadProgress');
        if (progress) {
            progress.style.display = 'none';
            progress.textContent = '';
        }

        document.querySelectorAll('.admin-card-row-item').forEach(el => el.classList.remove('selected'));
    }

    saveAdminCardFromForm() {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        const id = getVal('adminInputId');
        const name = getVal('adminInputName');
        if (!id || !name) {
            alert('Harap isi Card ID dan Nama Kartu!');
            return;
        }

        const nation = getVal('adminInputNation') || 'Dragon Empire';
        const type = getVal('adminInputType') || 'Normal Unit';
        const isCrest = type === 'Crest';
        const isToken = type === 'Token';
        const grade = parseInt(getVal('adminInputGrade'), 10) || 0;
        const power = parseInt(getVal('adminInputPower'), 10) || 0;
        const shield = parseInt(getVal('adminInputShield'), 10) || 0;
        const critical = parseInt(getVal('adminInputCrit'), 10) || 1;
        const trigger = type === 'Trigger Unit' ? (getVal('adminInputTrigger') || 'CRITICAL') : 'NONE';
        const image = getVal('adminInputImage') || 'img/Card/dztd01_002.webp';
        const ability = getVal('adminInputAbility');
        const effectScript = getVal('adminInputEffectScript');

        // Collect skills
        const skill = [];
        ['Boost', 'Intercept', 'TwinDrive', 'TripleDrive', 'Sentinel'].forEach(s => {
            const chk = document.getElementById(`adminSkill${s}`);
            if (chk && chk.checked) skill.push(chk.value);
        });

        const cardData = {
            id,
            name,
            nation,
            grade,
            basePower: power,
            power,
            baseShield: shield,
            shield,
            baseCritical: critical,
            critical,
            trigger,
            skill,
            image,
            ability,
            isCrest,
            isToken,
            cardType: type,
            effectScript
        };

        const oldId = this.adminSelectedCardId;
        saveCardToDatabase(cardData, oldId);
        this.adminSelectedCardId = id;
        this.renderAdminCardList();
        this.loadCardIntoAdminForm(getCardById(id));
        this.showSplash(`Kartu "${name}" berhasil disimpan ke Database!`, 'emerald');
    }

    duplicateAdminCard() {
        const idInput = document.getElementById('adminInputId');
        const nameInput = document.getElementById('adminInputName');
        if (!idInput || !nameInput) return;

        const newId = `${idInput.value.trim()}_copy_${Math.random().toString(36).substr(2, 4)}`;
        const newName = `${nameInput.value.trim()} (Copy)`;

        idInput.value = newId;
        nameInput.value = newName;
        this.adminSelectedCardId = null;

        const setTitle = document.getElementById('adminFormTitle');
        if (setTitle) setTitle.textContent = `Tambah Kartu Baru (Duplikat)`;

        const delBtn = document.getElementById('btnAdminDeleteCard');
        if (delBtn) delBtn.style.display = 'none';
        const delHeaderBtn = document.getElementById('btnAdminDeleteCardHeader');
        if (delHeaderBtn) delHeaderBtn.style.display = 'none';

        this.showSplash(`Duplikat dibuat! Klik "Simpan Kartu" untuk menyimpan sebagai kartu baru.`, 'cyan');
    }

    deleteAdminCurrentCard() {
        if (!this.adminSelectedCardId) {
            alert('Silakan pilih kartu yang ingin dihapus terlebih dahulu.');
            return;
        }
        const card = getCardById(this.adminSelectedCardId);
        const cardName = card ? card.name : this.adminSelectedCardId;

        if (confirm(`Yakin ingin menghapus kartu "${cardName}" [${this.adminSelectedCardId}] dari database?`)) {
            deleteCardFromDatabase(this.adminSelectedCardId);
            this.resetAdminForm();
            this.renderAdminCardList();
            this.showSplash(`Kartu "${cardName}" berhasil dihapus dari database.`, 'gold');
        }
    }

    showAdminExportModal() {
        const jsonStr = exportCardsData();
        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:650px;">
                <div class="modal-title">Export Data Kartu (JSON)</div>
                <p style="color:#94a3b8;font-size:12px;margin-bottom:12px;">
                    Salin teks JSON di bawah ini atau download sebagai file untuk backup atau membagikan kartu kustom kamu.
                </p>
                <textarea id="adminExportTextarea" class="admin-code-area" rows="12" style="width:100%;margin-bottom:14px;" readonly>${jsonStr}</textarea>
                <div style="display:flex;justify-content:flex-end;gap:10px;">
                    <button class="btn btn-emerald" id="btnAdminCopyJson">Salin ke Clipboard</button>
                    <button class="btn btn-cyan" id="btnAdminDownloadJson">Unduh File .json</button>
                    <button class="btn" id="btnCloseExportModal">Tutup</button>
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        document.getElementById('btnCloseExportModal').onclick = () => {
            this.elModal.style.display = 'none';
        };

        document.getElementById('btnAdminCopyJson').onclick = () => {
            const ta = document.getElementById('adminExportTextarea');
            if (ta) {
                ta.select();
                navigator.clipboard.writeText(ta.value);
                this.showSplash('JSON berhasil disalin ke clipboard!', 'emerald');
            }
        };

        document.getElementById('btnAdminDownloadJson').onclick = () => {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vg_cards_database_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
    }

    showAdminImportModal() {
        this.elModal.innerHTML = `
            <div class="modal-content" style="max-width:650px;">
                <div class="modal-title">Import Data Kartu (JSON)</div>
                <p style="color:#94a3b8;font-size:12px;margin-bottom:12px;">
                    Tempelkan data JSON kartu kustom di bawah ini. Kartu akan dimasukkan ke database browser secara otomatis.
                </p>
                <textarea id="adminImportTextarea" class="admin-code-area" rows="12" placeholder='Tempelkan JSON kartu di sini...' style="width:100%;margin-bottom:14px;"></textarea>
                <div style="display:flex;justify-content:flex-end;gap:10px;">
                    <button class="btn btn-emerald" id="btnAdminConfirmImport">Import & Simpan</button>
                    <button class="btn" id="btnCloseImportModal">Batal</button>
                </div>
            </div>
        `;
        this.elModal.style.display = 'flex';

        document.getElementById('btnCloseImportModal').onclick = () => {
            this.elModal.style.display = 'none';
        };

        document.getElementById('btnAdminConfirmImport').onclick = () => {
            const ta = document.getElementById('adminImportTextarea');
            if (!ta || !ta.value.trim()) {
                alert('Tolong tempelkan teks JSON kartu!');
                return;
            }
            const res = importCardsData(ta.value.trim());
            if (res.success) {
                this.elModal.style.display = 'none';
                this.renderAdminCardList();
                this.resetAdminForm();
                this.showSplash('Kartu berhasil diimport ke Database!', 'emerald');
            } else {
                alert(`Gagal import JSON: ${res.error}`);
            }
        };
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameUI = new VanguardUI();
});
