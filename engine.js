/**
 * Cardfight!! Vanguard D-Series Automated Rule Engine
 * Automates turns, phases, ride deck, circle positioning, boosting, guarding,
 * drive checks, trigger resolution, damage checks, and win/loss conditions.
 */

class VanguardEngine {
    constructor(deckKeyP1 = 'varga_dragres', deckKeyP2 = 'bastion_sanctuary') {
        this.deckKeyP1 = deckKeyP1;
        this.deckKeyP2 = deckKeyP2;
        this.listeners = [];
        this.logs = [];
        this.initGame();
    }

    onUpdate(fn) {
        this.listeners.push(fn);
    }

    notify(eventType = 'STATE_CHANGE', payload = {}) {
        this.listeners.forEach(fn => fn(this, eventType, payload));
    }

    log(msg, type = 'info') {
        const time = new Date().toLocaleTimeString();
        this.logs.push({ msg, type, time });
        if (this.logs.length > 100) this.logs.shift();
        this.notify('LOG', { msg, type });
    }

    initGame() {
        this.turn = 1;
        this.firstPlayer = 1;
        this.activePlayer = 1;
        this.phase = 'DICE_ROLL'; // DICE_ROLL -> MULLIGAN -> STAND_UP -> STAND -> DRAW -> RIDE -> MAIN -> BATTLE -> END
        this.winner = null;
        this.diceResult = null;

        this.p1 = this.createPlayerState(1, this.deckKeyP1);
        this.p2 = this.createPlayerState(2, this.deckKeyP2);

        this.combat = null;
        this.setupStartingGame();
    }

    createPlayerState(playerNum, deckKey) {
        const deckData = buildPlayableDeck(deckKey);
        return {
            id: playerNum,
            name: `Player ${playerNum}`,
            nation: deckData.nation,
            deck: deckData.mainDeck,
            rideDeck: deckData.rideDeck,
            hand: [],
            drop: [],
            damage: [],
            soul: [],
            bind: [],
            guardians: [],
            triggerZone: null,
            hasRiddenThisTurn: false,
            mulliganDone: false,
            turnCount: 0,
            energy: 0,
            crestZone: null,
            orderZone: [],
            personaRideActive: false,
            // Circles on field
            circles: {
                vc: null,     // Vanguard
                rc_fl: null,  // Front Left
                rc_fr: null,  // Front Right
                rc_bl: null,  // Back Left
                rc_bc: null,  // Back Center
                rc_br: null   // Back Right
            }
        };
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    shuffleDeck(player) {
        if (player && player.deck) {
            this.shuffle(player.deck);
        }
    }

    setupStartingGame() {
        [this.p1, this.p2].forEach(p => {
            this.shuffle(p.deck);

            // Extract Crest from Ride Deck to Crest Zone
            const crestIndex = p.rideDeck.findIndex(c => c.isCrest || c.id === 'dz_005' || (c.ability && c.ability.includes('[Crest]')));
            if (crestIndex !== -1) {
                p.crestZone = p.rideDeck.splice(crestIndex, 1)[0];
                p.energy = 0;
            }

            // Set Grade 0 from Ride Deck as First Vanguard on VC (face down initially)
            const g0Index = p.rideDeck.findIndex(c => c.grade === 0 && !c.isCrest && c.trigger === TRIGGER_TYPE.NONE);
            if (g0Index !== -1) {
                const g0 = p.rideDeck.splice(g0Index, 1)[0];
                p.circles.vc = {
                    card: g0,
                    isRest: false,
                    tempPower: 0,
                    tempCrit: 0,
                    faceDown: true
                };
            }

            // Draw initial 5 cards for opening hand
            for (let i = 0; i < 5; i++) {
                if (p.deck.length > 0) {
                    p.hand.push(p.deck.pop());
                }
            }
        });

        this.log("Game setup ready. Rolling dice for turn order.", "phase");
        this.notify('INIT');
    }

    // Roll Dice to decide who chooses First or Second
    rollDice() {
        let d1 = Math.floor(Math.random() * 6) + 1;
        let d2 = Math.floor(Math.random() * 6) + 1;
        while (d1 === d2) {
            d2 = Math.floor(Math.random() * 6) + 1;
        }

        const winner = d1 > d2 ? 1 : 2;
        this.diceResult = { d1, d2, winner };
        this.log(`Dice Roll: Player 1 rolled [${d1}] vs Player 2 rolled [${d2}]. Player ${winner} wins the roll!`, "highlight");
        this.notify('DICE_ROLLED', this.diceResult);
        return this.diceResult;
    }

    // Winner chooses First or Second
    chooseTurnOrder(firstPlayerNum) {
        this.firstPlayer = firstPlayerNum;
        this.activePlayer = firstPlayerNum;
        this.phase = 'MULLIGAN';
        this.log(`Player ${firstPlayerNum} will go FIRST (Turn 1). Starting Opening Hand Mulligan.`, "phase");
        this.notify('MULLIGAN_START');
    }

    // Mulligan execution
    performMulligan(playerNum, cardIndicesToReturn = []) {
        const p = playerNum === 1 ? this.p1 : this.p2;
        if (p.mulliganDone) return;

        if (cardIndicesToReturn.length > 0) {
            const sortedIndices = [...cardIndicesToReturn].sort((a, b) => b - a);
            const returnedCards = [];
            sortedIndices.forEach(idx => {
                if (p.hand[idx]) {
                    returnedCards.push(p.hand.splice(idx, 1)[0]);
                }
            });

            // Draw same number of cards
            for (let i = 0; i < returnedCards.length; i++) {
                if (p.deck.length > 0) p.hand.push(p.deck.pop());
            }

            // Put returned cards at bottom and shuffle
            p.deck.unshift(...returnedCards);
            this.shuffle(p.deck);
            this.log(`${p.name} mulliganed ${returnedCards.length} card(s).`, "info");
        } else {
            this.log(`${p.name} kept their opening hand.`, "info");
        }

        p.mulliganDone = true;

        // If both finished mulligan -> Stand Up Vanguard!
        if (this.p1.mulliganDone && this.p2.mulliganDone) {
            this.standUpVanguard();
        } else {
            this.notify();
        }
    }

    standUpVanguard() {
        this.phase = 'STAND_UP';
        [this.p1, this.p2].forEach(p => {
            if (p.circles.vc) p.circles.vc.faceDown = false;
        });
        this.log("Stand Up, Vanguard! Both First Vanguards revealed!", "highlight");
        
        // Start Turn 1 with chosen first player
        setTimeout(() => {
            this.startTurn(this.firstPlayer);
        }, 1200);
        this.notify('STAND_UP');
    }

    getActivePlayer() {
        return this.activePlayer === 1 ? this.p1 : this.p2;
    }

    getOpponentPlayer() {
        return this.activePlayer === 1 ? this.p2 : this.p1;
    }

    drawCard(player, reason = 'normal') {
        if (!player || player.deck.length === 0) {
            this.checkLoss(player, "Deck Out (No cards to draw)");
            return null;
        }
        const drawn = player.deck.pop();
        player.hand.push(drawn);
        this.notify('CARD_DRAWN', {
            player,
            card: drawn,
            reason
        });
        this.notify('STATE_CHANGE');
        return drawn;
    }

    startTurn(playerNum) {
        this.activePlayer = playerNum;
        const p = this.getActivePlayer();
        p.hasRiddenThisTurn = false;
        p.turnCount = (p.turnCount || 0) + 1;

        this.log(`--- TURN ${this.turn} : ${p.name}'s Turn ---`, "turn");
        this.notify('TURN_STARTED', { playerNum, turn: this.turn });

        // 1. Stand Phase: Stand all resting units
        this.phase = 'STAND_PHASE';
        Object.keys(p.circles).forEach(circleKey => {
            const unit = p.circles[circleKey];
            if (unit) {
                unit.isRest = false;
                unit.tempPower = 0;
                unit.tempCrit = 0;
                unit.actUsedThisTurn = false;
            }
        });
        this.log(`${p.name} Stand Phase: All units stood.`, "phase");
        this.notify('PHASE_CHANGE');

        // 2. Draw Phase: Draw 1 card
        setTimeout(() => {
            this.phase = 'DRAW_PHASE';
            const drawn = this.drawCard(p, 'turn_draw');
            if (drawn) {
                this.log(`${p.name} drew a card ("${drawn.name}"). (${p.deck.length} cards remaining in deck)`, "phase");
            }
            this.notify('PHASE_CHANGE');

            // 3. Ride Phase
            setTimeout(() => {
                this.phase = 'RIDE_PHASE';
                this.checkEnergyCharge(p);
                this.log(`${p.name} entered Ride Phase.`, "phase");
                this.notify('PHASE_CHANGE');
                this.notify('RIDE_PROMPT');
            }, 600);
        }, 600);
    }

        checkEnergyCharge(p) {
        if (!p.crestZone) return;
        const isFirstPlayer = (p.id === this.firstPlayer);
        let shouldCharge = false;
        if (isFirstPlayer) {
            if (p.turnCount >= 2) shouldCharge = true;
        } else {
            if (p.turnCount >= 1) shouldCharge = true;
        }

        if (shouldCharge) {
            const currentEnergy = p.energy || 0;
            if (currentEnergy < 10) {
                p.energy = Math.min(10, currentEnergy + 3);
                const gained = p.energy - currentEnergy;
                if (gained > 0) {
                    this.log(`[Energy Generator] ${p.name} Energy Charge (+${gained}) -> [${p.energy}/10]!`, "trigger");
                    this.notify("STATE_CHANGE");
                }
            }
        }
    }

    // Costs: Counter-Blast, Soul-Blast & Energy-Blast
    canCounterBlast(player, amount = 1) {
        if (!player || !player.damage) return false;
        const faceUpCount = player.damage.filter(c => !c.faceDown).length;
        return faceUpCount >= amount;
    }

    getFaceUpDamageCards(player) {
        if (!player || !player.damage) return [];
        const list = [];
        player.damage.forEach((card, idx) => {
            if (!card.faceDown) {
                list.push({ card, damageIndex: idx });
            }
        });
        return list;
    }

    payCounterBlastSpecific(player, damageIndices) {
        if (!player || !player.damage) return false;
        const paidNames = [];
        damageIndices.forEach(idx => {
            const c = player.damage[idx];
            if (c && !c.faceDown) {
                c.faceDown = true;
                paidNames.push(c.name);
            }
        });
        this.log(`[Counter-Blast] ${player.name} membayar CB(${damageIndices.length}) [${paidNames.join(', ')}]!`, "action");
        this.notify('STATE_CHANGE');
        return true;
    }

    payCounterBlast(player, amount = 1) {
        if (!this.canCounterBlast(player, amount)) return false;
        let paid = 0;
        const paidIndices = [];
        for (let i = player.damage.length - 1; i >= 0; i--) {
            if (!player.damage[i].faceDown) {
                paidIndices.push(i);
                paid++;
                if (paid >= amount) break;
            }
        }
        return this.payCounterBlastSpecific(player, paidIndices);
    }

    canSoulBlast(player, amount = 1) {
        return (player && player.soul && player.soul.length >= amount);
    }

    getSoulCards(player) {
        if (!player || !player.soul) return [];
        return player.soul.map((card, idx) => ({ card, soulIndex: idx }));
    }

    paySoulBlastSpecific(player, soulIndices) {
        if (!this.canSoulBlast(player, soulIndices.length)) return false;
        const sorted = [...soulIndices].sort((a, b) => b - a);
        const sentCards = [];
        sorted.forEach(idx => {
            const [c] = player.soul.splice(idx, 1);
            if (c) {
                player.drop.push(c);
                sentCards.push(c.name);
            }
        });
        this.log(`[Soul-Blast] ${player.name} membayar SB(${soulIndices.length}) dengan mengirim [${sentCards.join(', ')}] ke Drop Zone!`, "action");
        this.notify('STATE_CHANGE');
        return true;
    }

    paySoulBlast(player, amount = 1) {
        if (!this.canSoulBlast(player, amount)) return false;
        const defaultIndices = [];
        for (let i = player.soul.length - 1; i >= player.soul.length - amount; i--) {
            defaultIndices.push(i);
        }
        return this.paySoulBlastSpecific(player, defaultIndices);
    }

    canEnergyBlast(player, amount = 4) {
        return (player && (player.energy || 0) >= amount);
    }

    payEnergyBlast(player, amount = 4) {
        if (!this.canEnergyBlast(player, amount)) return false;
        player.energy = (player.energy || 0) - amount;
        this.log(`[Energy-Blast] ${player.name} membayar EB(${amount})! Sisa Energy: [${player.energy}/10].`, "action");
        this.notify('STATE_CHANGE');
        return true;
    }

    // Triumph Dragon [ACT](VC)[1/Turn]
    canActivateTriumphAct(player) {
        if (this.phase !== 'MAIN_PHASE' || this.activePlayer !== player.id) return false;
        const vcUnit = player.circles.vc;
        if (!vcUnit || vcUnit.actUsedThisTurn) return false;
        const isTriumph = vcUnit.card.id === 'dz_002' || (vcUnit.card.name && (vcUnit.card.name.toLowerCase().includes('triumph') || vcUnit.card.name.toLowerCase().includes('varga')));
        if (!isTriumph) return false;
        return this.canCounterBlast(player, 1);
    }

    getTriumphDeckCopies(player) {
        const vcUnit = player.circles.vc;
        if (!vcUnit) return [];
        const targetName = vcUnit.card.name;
        const matches = [];
        player.deck.forEach((card, idx) => {
            if (card.name === targetName || (card.id === 'dz_002' && vcUnit.card.id === 'dz_002')) {
                matches.push({ card, deckIndex: idx });
            }
        });
        return matches;
    }

    executeTriumphAct(player, deckIndex = null, damageIndex = null) {
        if (!this.canActivateTriumphAct(player)) return false;
        if (damageIndex !== null) {
            if (!this.payCounterBlastSpecific(player, [damageIndex])) return false;
        } else {
            if (!this.payCounterBlast(player, 1)) return false;
        }

        const vcUnit = player.circles.vc;
        vcUnit.actUsedThisTurn = true;

        let addedCard = null;
        if (deckIndex !== null && player.deck[deckIndex]) {
            addedCard = player.deck.splice(deckIndex, 1)[0];
            player.hand.push(addedCard);
            this.shuffleDeck(player);
            this.log(`[ACT Search] ${player.name} mencari "${addedCard.name}" dari deck dan menambahkannya ke tangan! Deck dikocok.`, "highlight");
        } else {
            const matches = this.getTriumphDeckCopies(player);
            if (matches.length > 0) {
                const targetIdx = matches[0].deckIndex;
                addedCard = player.deck.splice(targetIdx, 1)[0];
                player.hand.push(addedCard);
                this.shuffleDeck(player);
                this.log(`[ACT Search] ${player.name} mencari "${addedCard.name}" dari deck dan menambahkannya ke tangan! Deck dikocok.`, "highlight");
            } else {
                this.shuffleDeck(player);
                this.log(`[ACT Search] ${player.name} mencari deck, tidak ada salinan kartu ditemukan. Deck dikocok.`, "info");
            }
        }

        vcUnit.tempPower = (vcUnit.tempPower || 0) + 10000;
        this.log(`[ACT Power] "${vcUnit.card.name}" mendapatkan [Power] +10,000 sampai akhir giliran! Total Power: ${(vcUnit.card.power + vcUnit.tempPower).toLocaleString()}`, "highlight");

        this.notify('TRIUMPH_ACT_ACTIVATED', {
            player,
            addedCard,
            powerGained: 10000
        });
        this.notify('STATE_CHANGE');
        return true;
    }

    // Ride from Ride Deck: choose ride card first, then discard card
    rideFromRideDeck(rideDeckIndex, discardHandIndex) {
        const p = this.getActivePlayer();
        if (this.phase !== 'RIDE_PHASE' || p.hasRiddenThisTurn) return false;

        const rideCard = p.rideDeck[rideDeckIndex];
        const discardCard = p.hand[discardHandIndex];
        if (!rideCard || !discardCard) return false;

        const currentGrade = p.circles.vc ? p.circles.vc.card.grade : -1;
        if (rideCard.grade !== currentGrade + 1) {
            this.log(`Invalid ride: Ride deck card must be Grade ${currentGrade + 1}.`, "warn");
            return false;
        }

        // Pay cost: Discard 1 card from hand
        p.hand.splice(discardHandIndex, 1);
        p.drop.push(discardCard);

        // Previous vanguard goes into soul
        if (p.circles.vc) {
            p.soul.push(p.circles.vc.card);
        }

        // Put new vanguard on VC
        p.rideDeck.splice(rideDeckIndex, 1);
        p.circles.vc = {
            card: rideCard,
            isRest: false,
            tempPower: 0,
            tempCrit: 0,
            faceDown: false
        };

        p.hasRiddenThisTurn = true;
        this.log(`Ride! ${p.name} rode "${rideCard.name}" (Grade ${rideCard.grade}) from Ride Deck by discarding "${discardCard.name}". Soul: ${p.soul.length}.`, "highlight");
        this.notify('RIDE', { card: rideCard });
        return true;
    }

    // Normal Ride from Hand
    rideFromHand(handIndex) {
        const p = this.getActivePlayer();
        if (this.phase !== 'RIDE_PHASE' || p.hasRiddenThisTurn) return false;

        const rideCard = p.hand[handIndex];
        if (!rideCard) return false;

        const currentCard = p.circles.vc ? p.circles.vc.card : null;
        const currentGrade = currentCard ? currentCard.grade : 0;
        if (rideCard.grade !== currentGrade && rideCard.grade !== currentGrade + 1) {
            this.log(`Invalid normal ride: Grade must be equal or +1.`, "warn");
            return false;
        }

        const isPersonaRide = (currentGrade === 3 && rideCard.grade === 3 && currentCard && rideCard.name === currentCard.name);

        p.hand.splice(handIndex, 1);
        if (p.circles.vc) {
            p.soul.push(p.circles.vc.card);
        }

        p.circles.vc = {
            card: rideCard,
            isRest: false,
            tempPower: 0,
            tempCrit: 0,
            faceDown: false
        };

        p.hasRiddenThisTurn = true;

        if (isPersonaRide) {
            p.personaRideActive = true;
            this.drawCard(p, 'persona_ride');
            this.log(`[PERSONA RIDE] ${p.name} melakukan Persona Ride dengan "${rideCard.name}"! Draw 1 kartu & Front Row mendapatkan Power +10,000 sampai akhir giliran!`, "highlight");
            this.notify('PERSONA_RIDE', { card: rideCard, player: p });
        } else {
            this.log(`Normal Ride! ${p.name} rode "${rideCard.name}" (Grade ${rideCard.grade}) from hand. Soul: ${p.soul.length}.`, "highlight");
            this.notify('RIDE', { card: rideCard });
        }
        this.proceedToMainPhase();
        return true;
    }

    skipRide() {
        if (this.phase !== 'RIDE_PHASE') return;
        this.log(`${this.getActivePlayer().name} skipped Ride.`, "info");
        this.proceedToMainPhase();
    }

    proceedToMainPhase() {
        this.phase = 'MAIN_PHASE';
        this.log(`${this.getActivePlayer().name} entered Main Phase.`, "phase");
        this.notify('PHASE_CHANGE');
    }

    // Normal Call from Hand to RC
    callUnit(handIndex, circleKey) {
        const p = this.getActivePlayer();
        if (this.phase !== 'MAIN_PHASE') return false;
        if (!circleKey.startsWith('rc_')) return false;

        const card = p.hand[handIndex];
        if (!card) return false;

        const vanguardGrade = p.circles.vc ? p.circles.vc.card.grade : 0;
        if (card.grade > vanguardGrade) {
            this.log(`Cannot call: Card Grade (${card.grade}) exceeds Vanguard Grade (${vanguardGrade}).`, "warn");
            return false;
        }

        // If circle is occupied, old unit is retired to Drop
        if (p.circles[circleKey]) {
            const retired = p.circles[circleKey].card;
            p.drop.push(retired);
            this.log(`Retired "${retired.name}" from ${circleKey.toUpperCase()}.`, "info");
        }

        p.hand.splice(handIndex, 1);
        p.circles[circleKey] = {
            card,
            isRest: false,
            tempPower: 0,
            tempCrit: 0,
            faceDown: false
        };

        this.log(`${p.name} called "${card.name}" (Grade ${card.grade}, Power ${card.power}) to ${circleKey.toUpperCase()}.`, "action");
        this.notify('CALL', { card, circleKey });
        return true;
    }

    // Move or swap rear-guards in the same column
    moveOrSwapRearGuard(fromCircleKey, toCircleKey) {
        const p = this.getActivePlayer();
        if (this.phase !== 'MAIN_PHASE') return false;

        const validPairs = [
            ['rc_fl', 'rc_bl'],
            ['rc_bl', 'rc_fl'],
            ['rc_fr', 'rc_br'],
            ['rc_br', 'rc_fr']
        ];

        const isValid = validPairs.some(([f, t]) => f === fromCircleKey && t === toCircleKey);
        if (!isValid) {
            this.log("Can only move/swap rear-guards between front and back row in the SAME column.", "warn");
            return false;
        }

        const temp = p.circles[toCircleKey];
        p.circles[toCircleKey] = p.circles[fromCircleKey];
        p.circles[fromCircleKey] = temp;

        this.log(`${p.name} swapped units between ${fromCircleKey.toUpperCase()} and ${toCircleKey.toUpperCase()}.`, "action");
        this.notify('MOVE');
        return true;
    }

    proceedToBattlePhase() {
        const p = this.getActivePlayer();
        if (this.turn === 1) {
            this.log("First player cannot attack on Turn 1!", "warn");
            return false;
        }

        this.phase = 'BATTLE_START';
        this.log(`${p.name} entered Battle Phase.`, "phase");
        this.notify('PHASE_CHANGE');
        return true;
    }

    // Declare Attack
    declareAttack(attackerCircleKey, targetCircleKey, boosterCircleKey = null) {
        const p = this.getActivePlayer();
        const opp = this.getOpponentPlayer();

        const frontRowKeys = ['vc', 'rc_fl', 'rc_fr'];
        if (!frontRowKeys.includes(attackerCircleKey)) {
            this.log("Attacking unit must be in the front row!", "warn");
            return false;
        }

        const attackerUnit = p.circles[attackerCircleKey];
        if (!attackerUnit || attackerUnit.isRest) {
            this.log("Attacker must be standing!", "warn");
            return false;
        }

        const validTargets = ['vc', 'rc_fl', 'rc_fr'];
        if (!validTargets.includes(targetCircleKey) || !opp.circles[targetCircleKey]) {
            this.log("Target must be an enemy front-row unit!", "warn");
            return false;
        }

        const targetUnit = opp.circles[targetCircleKey];

        // Rest attacker
        attackerUnit.isRest = true;

        // Check optional boost chosen by the player
        let boostUnit = null;
        let boostPower = 0;
        const boostMap = {
            'rc_fl': 'rc_bl',
            'vc': 'rc_bc',
            'rc_fr': 'rc_br'
        };

        if (boosterCircleKey && boostMap[attackerCircleKey] === boosterCircleKey && p.circles[boosterCircleKey]) {
            const bUnit = p.circles[boosterCircleKey];
            if (!bUnit.isRest && (bUnit.card.grade <= 1 || bUnit.card.skill.includes('BOOST'))) {
                bUnit.isRest = true;
                boostUnit = bUnit;
                boostPower = bUnit.card.power + (bUnit.tempPower || 0);
                this.log(`"${bUnit.card.name}" (Power ${boostPower}) boosted "${attackerUnit.card.name}"!`, "action");
            }
        }

        this.combat = {
            attackerCircleKey,
            attackerUnit,
            targetCircleKey,
            targetUnit,
            boostUnit,
            boostPower,
            guardians: [],
            totalShield: 0,
            isSentinelGuarded: false,
            driveCount: attackerCircleKey === 'vc' ? (attackerUnit.card.skill.includes('TRIPLE_DRIVE') || attackerUnit.card.grade === 4 ? 3 : (attackerUnit.card.skill.includes('TWIN_DRIVE') ? 2 : 1)) : 0,
            drivesResolved: 0
        };

        const totalAttackPower = this.getAttackerTotalPower();
        const targetCurrentPower = targetUnit.card.power + (targetUnit.tempPower || 0);
        this.log(`Battle: "${attackerUnit.card.name}" (${totalAttackPower} Power${boostUnit ? ' with Boost' : ''}) attacks "${targetUnit.card.name}" (${targetCurrentPower} Power)!`, "highlight");

        // Check if attacker has on-attack [AUTO] ability:
        // Triumph Dragon: [AUTO](VC): When this unit attacks a vanguard, [COST][Energy-Blast 4], retire 1 opponent rear-guard, +5000 Power & +1 Critical!
        const isTriumph = attackerCircleKey === 'vc' && targetCircleKey === 'vc' &&
            (attackerUnit.card.id === 'dz_002' || (attackerUnit.card.name && (attackerUnit.card.name.toLowerCase().includes('triumph') || attackerUnit.card.name.toLowerCase().includes('varga'))));

        if (isTriumph && this.canEnergyBlast(p, 4)) {
            this.phase = 'ATTACK_EFFECT_STEP';
            this.notify('ON_ATTACK_ABILITY_PROMPT', {
                player: p,
                card: attackerUnit.card,
                costEB: 4,
                abilityName: 'Triumph Dragon [AUTO]'
            });
            this.notify('STATE_CHANGE');
            return true;
        }

        this.phase = 'GUARD_STEP';
        this.notify('ATTACK_DECLARED');
        return true;
    }

    activateTriumphAuto(retireCircleKey = null) {
        if (!this.combat || this.phase !== 'ATTACK_EFFECT_STEP') return false;
        const p = this.getActivePlayer();
        const opp = this.getOpponentPlayer();

        if (!this.payEnergyBlast(p, 4)) return false;

        let retiredCard = null;
        if (retireCircleKey && opp.circles[retireCircleKey]) {
            retiredCard = opp.circles[retireCircleKey].card;
            opp.drop.push(retiredCard);
            opp.circles[retireCircleKey] = null;
            this.log(`[AUTO Retire] Rear-guard lawan "${retiredCard.name}" (${retireCircleKey.toUpperCase()}) di-retire ke Drop Zone!`, "highlight");
        }

        this.combat.attackerUnit.tempPower = (this.combat.attackerUnit.tempPower || 0) + 5000;
        this.combat.attackerUnit.tempCrit = (this.combat.attackerUnit.tempCrit || 0) + 1;
        const finalCrit = (this.combat.attackerUnit.card.critical || 1) + (this.combat.attackerUnit.tempCrit || 0);
        this.log(`[AUTO Power & Crit] "${this.combat.attackerUnit.card.name}" mendapatkan [Power] +5,000 dan [Critical] +1 (Total Crit: ${finalCrit}) hingga akhir pertarungan!`, "highlight");

        this.notify('TRIUMPH_AUTO_RESOLVED', {
            player: p,
            retiredCircleKey: retireCircleKey,
            retiredCard,
            powerGained: 5000,
            critGained: 1
        });

        // Proceed to Guard Step
        this.phase = 'GUARD_STEP';
        this.notify('ATTACK_DECLARED');
        this.notify('STATE_CHANGE');
        return true;
    }

    skipAttackAbility() {
        if (!this.combat || this.phase !== 'ATTACK_EFFECT_STEP') return;
        this.phase = 'GUARD_STEP';
        this.notify('ATTACK_DECLARED');
        this.notify('STATE_CHANGE');
    }

    getAttackerTotalPower() {
        if (!this.combat || !this.combat.attackerUnit) return 0;
        const u = this.combat.attackerUnit;
        const p = this.getActivePlayer();
        const personaBonus = (p.personaRideActive && ['vc', 'rc_fl', 'rc_fr'].includes(this.combat.attackerCircleKey)) ? 10000 : 0;
        return (u.card.power || 0) + (u.tempPower || 0) + (this.combat.boostPower || 0) + personaBonus;
    }

    getAttackerTotalCrit() {
        if (!this.combat || !this.combat.attackerUnit) return 1;
        const u = this.combat.attackerUnit;
        return (u.card.critical || u.card.baseCritical || 1) + (u.tempCrit || 0);
    }

    getDefenderTotalPower() {
        if (!this.combat || !this.combat.targetUnit) return 0;
        const t = this.combat.targetUnit;
        const opp = this.getOpponentPlayer();
        const personaBonus = (opp.personaRideActive && ['vc', 'rc_fl', 'rc_fr'].includes(this.combat.targetCircleKey)) ? 10000 : 0;
        return (t.card.power || 0) + (t.tempPower || 0) + (this.combat.totalShield || 0) + personaBonus;
    }

    getCombatGuardStats() {
        if (!this.combat || !this.combat.attackerUnit || !this.combat.targetUnit) return null;
        const atkPower = this.getAttackerTotalPower();
        const opp = this.getOpponentPlayer();
        const t = this.combat.targetUnit;
        const personaBonus = (opp.personaRideActive && ['vc', 'rc_fl', 'rc_fr'].includes(this.combat.targetCircleKey)) ? 10000 : 0;
        const baseDefPower = (t.card.power || 0) + (t.tempPower || 0) + personaBonus;
        const totalShield = this.combat.totalShield || 0;
        const totalDefPower = baseDefPower + totalShield;
        const diff = totalDefPower - atkPower;
        const isSentinel = !!this.combat.isSentinelGuarded;
        const driveCount = this.combat.driveCount || 1;

        let passType = '0_PASS';
        let passLabel = '0 PASS (TEMBUS)';
        let passClass = 'zero-pass';
        let passDesc = `Attacker unggul +${Math.abs(diff).toLocaleString()} Power!`;

        if (isSentinel) {
            passType = 'PERFECT_GUARD';
            passLabel = 'PERFECT GUARD';
            passClass = 'perfect-guard';
            passDesc = 'Serangan tidak dapat tembus (Sentinel)';
        } else if (diff <= 0) {
            passType = '0_PASS';
            passLabel = '0 PASS (TEMBUS)';
            passClass = 'zero-pass';
            passDesc = diff === 0 ? 'Power sama (serangan tetap tembus!)' : `Attacker unggul +${Math.abs(diff).toLocaleString()}`;
        } else if (diff <= 10000) {
            passType = '1_PASS';
            passLabel = '1 PASS';
            passClass = 'one-pass';
            passDesc = 'Attacker butuh 1 trigger (+10k) untuk tembus!';
        } else if (diff <= 20000) {
            passType = '2_PASS';
            passLabel = '2 PASS';
            passClass = 'two-pass';
            passDesc = 'Attacker butuh 2 trigger (+20k) untuk tembus!';
        } else if (diff <= 30000) {
            passType = '3_PASS';
            passLabel = '3 PASS';
            passClass = 'three-pass';
            passDesc = 'Attacker butuh 3 trigger (+30k) untuk tembus!';
        } else {
            passType = 'NO_PASS';
            passLabel = 'NO PASS (AMAN)';
            passClass = 'no-pass';
            passDesc = `Pertahanan unggul +${diff.toLocaleString()} Power!`;
        }

        return {
            atkPower,
            baseDefPower,
            totalShield,
            totalDefPower,
            diff,
            isSentinel,
            driveCount,
            passType,
            passLabel,
            passClass,
            passDesc,
            guardians: this.combat.guardians || []
        };
    }

    // Defender adds Guardian from Hand
    callGuardian(handIndex) {
        if (this.phase !== 'GUARD_STEP' || !this.combat) return false;
        const opp = this.getOpponentPlayer();
        const card = opp.hand[handIndex];
        if (!card) return false;

        opp.hand.splice(handIndex, 1);
        opp.guardians.push(card);
        this.combat.guardians.push(card);
        const shieldVal = card.shield || 0;
        this.combat.totalShield += shieldVal;

        if (card.skill && card.skill.includes('SENTINEL')) {
            this.combat.isSentinelGuarded = true;
            this.log(`[Sentinel] ${opp.name} guarded with "${card.name}"! Unit tidak dapat terkena hit pada pertarungan ini!`, "highlight");
        } else {
            this.log(`${opp.name} guarded with "${card.name}" (+${shieldVal.toLocaleString()} Shield). Total Shield: +${this.combat.totalShield.toLocaleString()}.`, "action");
        }

        this.notify('GUARD_ADDED', { card });
        this.notify('STATE_CHANGE');
        return true;
    }

    // Intercept with Grade 2 front-row rear-guard
    intercept(circleKey) {
        if (this.phase !== 'GUARD_STEP' || !this.combat) return false;
        const opp = this.getOpponentPlayer();
        if (circleKey !== 'rc_fl' && circleKey !== 'rc_fr') return false;

        const unit = opp.circles[circleKey];
        if (!unit || unit.card.grade !== 2) return false;

        opp.circles[circleKey] = null;
        opp.guardians.push(unit.card);
        this.combat.guardians.push(unit.card);
        const shieldVal = unit.card.shield || 5000;
        this.combat.totalShield += shieldVal;

        this.log(`Intercept! ${opp.name} intercepted with "${unit.card.name}" from ${circleKey.toUpperCase()} (+${shieldVal} Shield).`, "highlight");
        this.notify('INTERCEPT', { card: unit.card });
        return true;
    }

    finishGuardStep() {
        if (this.phase !== 'GUARD_STEP' || !this.combat) return;

        if (this.combat.driveCount > 0) {
            this.phase = 'DRIVE_STEP';
            this.log(`Drive Step! Vanguard performs ${this.combat.driveCount} Drive Check(s)!`, "highlight");
            this.notify('DRIVE_STEP_START');
            this.executeNextDriveCheck();
        } else {
            this.resolveBattleHit();
        }
    }

    executeNextDriveCheck() {
        const p = this.getActivePlayer();
        if (p.deck.length === 0) {
            this.checkLoss(p, "Deck Out during Drive Check");
            return;
        }

        const driveCard = p.deck.pop();
        p.triggerZone = driveCard;
        this.combat.drivesResolved++;

        this.log(`Drive Check #${this.combat.drivesResolved}: Revealed "${driveCard.name}" [Grade ${driveCard.grade}]!`, "trigger");

        this.notify('DRIVE_CHECK_REVEAL', {
            card: driveCard,
            step: this.combat.drivesResolved,
            total: this.combat.driveCount,
            isTrigger: driveCard.trigger !== TRIGGER_TYPE.NONE,
            triggerType: driveCard.trigger,
            player: p
        });
    }

    putDriveCardToHand(driveCard) {
        const p = this.getActivePlayer();
        p.hand.push(driveCard);
        p.triggerZone = null;
        this.notify('STATE_CHANGE');
    }

    finishDriveCheckStep() {
        if (!this.combat) return;
        if (this.combat.drivesResolved < this.combat.driveCount) {
            setTimeout(() => this.executeNextDriveCheck(), 400);
        } else {
            setTimeout(() => this.resolveBattleHit(), 600);
        }
    }

    finishDriveCheckCard(driveCard) {
        this.putDriveCardToHand(driveCard);
        this.finishDriveCheckStep();
    }

    applyTriggerPower(player, circleKey, powerAmount = 10000) {
        const unit = player.circles[circleKey];
        if (!unit) return false;
        unit.tempPower = (unit.tempPower || 0) + powerAmount;
        const circleName = circleKey === 'vc' ? 'Vanguard' : circleKey.toUpperCase();
        this.log(`[Trigger Power] "${unit.card.name}" (${circleName}) mendapatkan +${powerAmount.toLocaleString()} Power!`, "trigger");
        this.notify('STATE_CHANGE');
        return true;
    }

    applyTriggerCritical(player, circleKey, critAmount = 1) {
        const unit = player.circles[circleKey];
        if (!unit) return false;
        unit.tempCrit = (unit.tempCrit || 0) + critAmount;
        const circleName = circleKey === 'vc' ? 'Vanguard' : circleKey.toUpperCase();
        this.log(`[Trigger Critical] "${unit.card.name}" (${circleName}) mendapatkan +${critAmount} Critical!`, "trigger");
        this.notify('STATE_CHANGE');
        return true;
    }

    applyTriggerAdditional(player, triggerType) {
        switch (triggerType) {
            case TRIGGER_TYPE.DRAW:
                {
                    const drawn = this.drawCard(player, 'draw_trigger');
                    if (drawn) {
                        this.log(`[Draw Trigger] ${player.name} mengambil 1 kartu ("${drawn.name}") dari deck!`, "trigger");
                    }
                }
                break;

            case TRIGGER_TYPE.FRONT:
                ['vc', 'rc_fl', 'rc_fr'].forEach(k => {
                    if (player.circles[k]) {
                        player.circles[k].tempPower = (player.circles[k].tempPower || 0) + 10000;
                    }
                });
                this.log(`[Front Trigger] Seluruh Front Row mendapatkan Power +10,000!`, "trigger");
                break;

            case TRIGGER_TYPE.HEAL:
                const opp = player === this.p1 ? this.p2 : this.p1;
                if (player.damage.length >= opp.damage.length && player.damage.length > 0) {
                    const healedCard = player.damage.pop();
                    player.drop.push(healedCard);
                    this.log(`[Heal Trigger] Damage ${player.name} (${player.damage.length + 1}) >= Lawan (${opp.damage.length}): Berhasil Heal 1 kartu ("${healedCard.name}") ke Drop Zone!`, "trigger");
                } else {
                    this.log(`[Heal Trigger] Damage ${player.name} (${player.damage.length}) < Lawan (${opp.damage.length}): Efek Heal tidak aktif.`, "info");
                }
                break;

            case TRIGGER_TYPE.OVER:
                this.drawCard(player, 'over_trigger');
                if (player.triggerZone) {
                    player.bind.push(player.triggerZone);
                    player.triggerZone = null;
                }
                this.log(`[OVER TRIGGER] ${player.name} Draw 1 kartu & Over Trigger dipindahkan ke Bind Zone!`, "trigger");
                break;
        }
        this.notify('STATE_CHANGE');
    }

    resolveTrigger(player, triggerCard, isDriveCheck, powerTargetKey = 'vc', critTargetKey = 'vc') {
        this.log(`*** TRIGGER CHECK: ${triggerCard.trigger} TRIGGER ACTIVATED! ***`, "trigger");
        
        if (triggerCard.trigger === TRIGGER_TYPE.FRONT) {
            this.applyTriggerAdditional(player, triggerCard.trigger);
            return `${triggerCard.trigger} Trigger Resolved!`;
        }

        const powerAmount = triggerCard.trigger === TRIGGER_TYPE.OVER ? 100000000 : 10000;
        this.applyTriggerPower(player, powerTargetKey, powerAmount);

        if (triggerCard.trigger === TRIGGER_TYPE.CRITICAL) {
            this.applyTriggerCritical(player, critTargetKey, 1);
        }

        this.applyTriggerAdditional(player, triggerCard.trigger);
        return `${triggerCard.trigger} Trigger Resolved!`;
    }

    resolveBattleHit() {
        if (!this.combat) return;

        const atkPower = this.getAttackerTotalPower();
        const defPower = this.getDefenderTotalPower();
        const opp = this.getOpponentPlayer();
        const isSentinel = !!this.combat.isSentinelGuarded;
        const isHit = !isSentinel && (atkPower >= defPower);

        const resMsg = isSentinel
            ? `Battle Resolution: Defender guarded with Sentinel -> GUARDED / MISS!`
            : `Battle Resolution: Attacker (${atkPower.toLocaleString()}) vs Defender (${defPower.toLocaleString()}) -> ${isHit ? 'HIT!' : 'GUARDED / MISS!'}`;
        this.log(resMsg, isHit ? "highlight" : "info");

        if (isHit) {
            if (this.combat.targetCircleKey === 'vc') {
                const crit = (this.combat.attackerUnit.card.critical || 1) + (this.combat.attackerUnit.tempCrit || 0);
                this.log(`Attack hit Vanguard! Dealing ${crit} damage!`, "highlight");
                this.executeDamageStep(crit, 0);
                return;
            } else {
                const retired = this.combat.targetUnit.card;
                opp.drop.push(retired);
                opp.circles[this.combat.targetCircleKey] = null;
                this.log(`Enemy rear-guard "${retired.name}" was retired to Drop Zone!`, "action");
            }
        }

        this.closeBattle();
    }

    executeDamageStep(totalDamage, currentDamageCount) {
        if (currentDamageCount >= totalDamage) {
            this.closeBattle();
            return;
        }

        const opp = this.getOpponentPlayer();
        if (opp.deck.length === 0) {
            this.checkLoss(opp, "Deck Out during Damage Check");
            return;
        }

        const damageCard = opp.deck.pop();
        opp.triggerZone = damageCard;
        const currentCount = currentDamageCount + 1;

        this.log(`Damage Check (${currentCount}/${totalDamage}): ${opp.name} revealed "${damageCard.name}"!`, "trigger");

        this.notify('DAMAGE_CHECK_REVEAL', {
            card: damageCard,
            step: currentCount,
            total: totalDamage,
            isTrigger: damageCard.trigger !== TRIGGER_TYPE.NONE,
            triggerType: damageCard.trigger,
            player: opp
        });
    }

    finishDamageCheckCard(damageCard, totalDamage, currentCount) {
        const opp = this.getOpponentPlayer();
        opp.damage.push(damageCard);
        opp.triggerZone = null;
        this.log(`${opp.name} Damage Zone: ${opp.damage.length}/6.`, "info");
        this.notify('STATE_CHANGE');

        if (opp.damage.length >= 6) {
            this.checkLoss(opp, "Reached 6 Damage");
            return;
        }

        setTimeout(() => {
            this.executeDamageStep(totalDamage, currentCount);
        }, 400);
    }

    closeBattle() {
        const opp = this.getOpponentPlayer();

        if (this.combat && this.combat.guardians.length > 0) {
            opp.drop.push(...this.combat.guardians);
            opp.guardians = [];
        }

        this.combat = null;
        this.phase = 'BATTLE_START';
        this.log("Battle closed. You can attack with another standing unit or end your turn.", "info");
        this.notify('BATTLE_CLOSED');
    }

    endTurn() {
        const p = this.getActivePlayer();
        const opp = this.getOpponentPlayer();
        this.phase = 'END_PHASE';
        this.log(`--- ${p.name} End Phase ---`, "phase");

        p.personaRideActive = false;
        opp.personaRideActive = false;

        Object.keys(p.circles).forEach(k => {
            if (p.circles[k]) {
                p.circles[k].tempPower = 0;
                p.circles[k].tempCrit = 0;
                p.circles[k].actUsedThisTurn = false;
            }
        });

        Object.keys(opp.circles).forEach(k => {
            if (opp.circles[k]) {
                opp.circles[k].tempPower = 0;
                opp.circles[k].tempCrit = 0;
                opp.circles[k].actUsedThisTurn = false;
            }
        });

        this.turn++;
        const nextPlayer = this.activePlayer === 1 ? 2 : 1;
        this.startTurn(nextPlayer);
    }

    checkLoss(player, reason) {
        this.winner = player.id === 1 ? 2 : 1;
        this.phase = 'GAME_OVER';
        this.log(`GAME OVER! ${player.name} loses due to: ${reason}! Player ${this.winner} WINS!`, "highlight");
        this.notify('GAME_OVER', { winner: this.winner, reason });
    }
}

