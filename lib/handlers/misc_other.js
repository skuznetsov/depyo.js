const AST = require('../ast/ast_node');

/**
 * Reconstruct pattern from recorded operations
 * @param {Array} patternOps - Array of pattern operations
 * @returns {{pattern: ASTPattern, remainderOps: Array}} pattern plus leftover operations
 */
function reconstructPattern(patternOps) {
    const ops = patternOps || [];
    const consumed = new Set();

    const markConsumed = (op) => {
        if (op) {
            consumed.add(op);
        }
    };

    const buildResult = (pattern) => {
        let remainderOps = ops.filter(op => !consumed.has(op));

        // AS-pattern: leftover single STORE_FAST wraps existing pattern
        const asStore = remainderOps.find(op => op.type === 'STORE_FAST');
        if (asStore && pattern) {
            markConsumed(asStore);
            pattern = new AST.ASTPattern(AST.ASTPattern.PatternType.As, {
                pattern,
                name: asStore.name
            });
            remainderOps = ops.filter(op => !consumed.has(op));
        }

        return {pattern, remainderOps};
    };

    if (ops.length === 0) {
        return buildResult(new AST.ASTPattern(AST.ASTPattern.PatternType.Wildcard, '_'));
    }

    // Find key operations
    let matchSeqOp = ops.find(op => op.type === 'MATCH_SEQUENCE');
    let hasMatchSeq = !!matchSeqOp;
    let matchClassOp = ops.find(op => op.type === 'MATCH_CLASS');
    let matchKeysOp = ops.find(op => op.type === 'MATCH_KEYS');
    let matchMappingOp = ops.find(op => op.type === 'MATCH_MAPPING');
    let unpackOp = ops.find(op => op.type === 'UNPACK_SEQUENCE');
    let compareOp = ops.find(op => op.type === 'COMPARE');
    let getLenOpIndex = ops.findIndex(op => op.type === 'GET_LEN');

    // In 3.13+, MATCH_SEQUENCE is preceded by GET_LEN/COMPARE length checks.
    if (hasMatchSeq && getLenOpIndex >= 0) {
        markConsumed(ops[getLenOpIndex]);
        const cmpAfterLen = ops.slice(getLenOpIndex + 1).find(op => op.type === 'COMPARE');
        if (cmpAfterLen) {
            markConsumed(cmpAfterLen);
        }
    }

    if (matchKeysOp || matchMappingOp) {
        if (matchKeysOp) {
            markConsumed(matchKeysOp);
        }
        if (matchMappingOp) {
            markConsumed(matchMappingOp);
        }

        const keys = matchKeysOp?.keys || [];
        const stores = ops.filter(op => op.type === 'STORE_FAST');
        const entries = [];

        let idx = 0;
        for (; idx < keys.length; idx++) {
            const keyNode = keys[idx];
            let pattern = null;
            if (stores[idx]) {
                pattern = new AST.ASTPattern(AST.ASTPattern.PatternType.Variable, stores[idx].name);
                markConsumed(stores[idx]);
            } else {
                pattern = new AST.ASTPattern(AST.ASTPattern.PatternType.Wildcard, '_');
            }
            entries.push({key: keyNode, pattern});
        }

        // Consume any extra stores associated with mapping binding
        for (; idx < stores.length; idx++) {
            markConsumed(stores[idx]);
        }

        return buildResult(new AST.ASTPattern(
            AST.ASTPattern.PatternType.Mapping,
            entries
        ));
    }

    if (matchClassOp) {
        markConsumed(matchClassOp);
        const attributes = [];
        const attrNames = matchClassOp.attrNames || [];

        // Determine how many positional attributes are expected (fallback to opcode count)
        let attrCount = attrNames.length;
        if (!attrCount && matchClassOp.count) {
            attrCount = matchClassOp.count;
        }

        // Focus on operations that happen after UNPACK_SEQUENCE (if present)
        let attrOpsStart = ops.indexOf(matchClassOp) + 1;
        let attrOps = ops.slice(attrOpsStart);
        const unpackIndex = attrOps.findIndex(op => op.type === 'UNPACK_SEQUENCE');
        if (unpackIndex >= 0) {
            attrOps = attrOps.slice(unpackIndex + 1);
            if (unpackOp) {
                markConsumed(unpackOp);
            }
        }

        // Handle SWAP 2 which reverses attribute evaluation order
        let reverseOrder = false;
        if (attrOps.length && attrOps[0].type === 'SWAP' && attrOps[0].depth === 2) {
            markConsumed(attrOps[0]);
            reverseOrder = true;
            attrOps = attrOps.slice(1);
        }

        // Collect COMPARE / STORE_FAST operations that correspond to attributes
        const attributeOps = [];
        for (const op of attrOps) {
            if (op.type === 'COMPARE' || op.type === 'STORE_FAST') {
                attributeOps.push(op);
                markConsumed(op);
            }
            if (attrCount && attributeOps.length >= attrCount) {
                break;
            }
        }

        if (reverseOrder) {
            attributeOps.reverse();
        }

        let attrIndex = 0;
        for (const op of attributeOps) {
            if (attrCount && attrIndex >= attrCount) {
                break;
            }

            if (op.type === 'COMPARE') {
                const literalPattern = new AST.ASTPattern(
                    AST.ASTPattern.PatternType.Literal,
                    op.right
                );
                const name = attrNames.length ? (attrNames[attrIndex] || `_attr${attrIndex}`) : null;
                attributes.push({name, pattern: literalPattern});
            } else if (op.type === 'STORE_FAST') {
                const varPattern = new AST.ASTPattern(
                    AST.ASTPattern.PatternType.Variable,
                    op.name
                );
                const name = attrNames.length ? (attrNames[attrIndex] || op.name || `_attr${attrIndex}`) : null;
                attributes.push({name, pattern: varPattern});
            }

            attrIndex++;
        }

        // If there are declared attributes without recorded ops, fill them with wildcards
        while (attrIndex < attrNames.length) {
            attributes.push({
                name: attrNames[attrIndex],
                pattern: new AST.ASTPattern(AST.ASTPattern.PatternType.Wildcard, '_')
            });
            attrIndex++;
        }

        return buildResult(new AST.ASTPattern(
            AST.ASTPattern.PatternType.Class,
            {
                classExpr: matchClassOp.classExpr,
                attributes
            }
        ));
    }

    // Literal OR pattern: multiple COMPARE_OP checks in a row
    const allCompareOps = ops.filter(op => op.type === 'COMPARE');
    if (!hasMatchSeq && allCompareOps.length > 1) {
        const orPatterns = [];
        for (const cmp of allCompareOps) {
            markConsumed(cmp);
            if (cmp.right instanceof AST.ASTObject) {
                orPatterns.push(new AST.ASTPattern(AST.ASTPattern.PatternType.Literal, cmp.right));
            } else if (cmp.right instanceof AST.ASTName) {
                orPatterns.push(new AST.ASTPattern(AST.ASTPattern.PatternType.Variable, cmp.right.name));
            } else {
                orPatterns.push(new AST.ASTPattern(AST.ASTPattern.PatternType.Wildcard, '_'));
            }
        }
        return buildResult(new AST.ASTPattern(AST.ASTPattern.PatternType.Or, orPatterns));
    }

    // Literal pattern: Just COMPARE (no MATCH_SEQUENCE)
    if (!hasMatchSeq && compareOp) {
        markConsumed(compareOp);
        // Pure literal pattern: case 1: or case "string":
        // right operand is the literal value
        if (compareOp.right instanceof AST.ASTObject) {
            return buildResult(new AST.ASTPattern(AST.ASTPattern.PatternType.Literal, compareOp.right));
        }
        // Fallback
        return buildResult(new AST.ASTPattern(AST.ASTPattern.PatternType.Wildcard, '_'));
    }

    if (!hasMatchSeq) {
        // No MATCH_SEQUENCE and no COMPARE → wildcard
        return buildResult(new AST.ASTPattern(AST.ASTPattern.PatternType.Wildcard, '_'));
    }

    if (!unpackOp) {
        // MATCH_SEQUENCE but no UNPACK → wildcard sequence match
        return buildResult(new AST.ASTPattern(AST.ASTPattern.PatternType.Wildcard, '_'));
    }

    // Build sequence pattern with unpacked elements
    let count = unpackOp.count;
    let elements = [];

    // Find element patterns after UNPACK_SEQUENCE
    // Next COMPARE or STORE_FAST operations define elements
    let unpackIndex = ops.findIndex(op => op.type === 'UNPACK_SEQUENCE');
    let afterUnpack = ops.slice(unpackIndex + 1);

    // Check for SWAP operation (indicates element order reversal)
    let hasSwap = afterUnpack.length > 0 && afterUnpack[0].type === 'SWAP' && afterUnpack[0].depth === 2;

    // Skip SWAP when processing elements
    if (hasSwap) {
        markConsumed(afterUnpack[0]);
        afterUnpack = afterUnpack.slice(1);
    }

    // Process operations to extract element patterns
    let elementIndex = 0;
    for (let i = 0; i < afterUnpack.length && elementIndex < count; i++) {
        let op = afterUnpack[i];

        if (op.type === 'COMPARE') {
            // Literal pattern: value is compared
            // right is ASTObject with the literal value
            if (op.right instanceof AST.ASTObject) {
                let literalValue = op.right;
                elements.push(new AST.ASTPattern(AST.ASTPattern.PatternType.Literal, literalValue));
                markConsumed(op);
                elementIndex++;
            }
        } else if (op.type === 'STORE_FAST') {
            // Variable pattern: value is captured
            let varName = op.name;
            elements.push(new AST.ASTPattern(AST.ASTPattern.PatternType.Variable, varName));
            markConsumed(op);
            elementIndex++;
        }
    }

    // Fill remaining with wildcards if needed
    while (elements.length < count) {
        elements.push(new AST.ASTPattern(AST.ASTPattern.PatternType.Wildcard, '_'));
    }

    // If SWAP was used, reverse element order
    // SWAP 2 after UNPACK indicates elements were swapped to change check order
    // We need to reverse to restore source pattern order
    if (hasSwap) {
        elements.reverse();
    }

    // Create sequence pattern
    markConsumed(matchSeqOp);
    markConsumed(unpackOp);
    return buildResult(new AST.ASTPattern(AST.ASTPattern.PatternType.Sequence, elements));
}

function hasUpcomingMatchCase() {
    const nextOpCodeId = this.code.Next?.OpCodeID;
    const nextNextOpCodeId = this.code.Next?.Next?.OpCodeID;
    const matchOpcodes = [
        this.OpCodes.MATCH_SEQUENCE,
        this.OpCodes.MATCH_MAPPING,
        this.OpCodes.MATCH_KEYS,
        this.OpCodes.MATCH_CLASS_A
    ];

    if (matchOpcodes.includes(nextOpCodeId)) {
        return true;
    }

    let isCopy = (nextOpCodeId == this.OpCodes.COPY_A && this.code.Next?.Argument == 1) ||
                 nextOpCodeId == this.OpCodes.DUP_TOP;
    if (isCopy) {
        return true;
    }

    let nextIsPop = nextOpCodeId == this.OpCodes.POP_TOP;
    let nextNextIsCopy = nextNextOpCodeId == this.OpCodes.COPY_A;
    let nextNextIsMatch = nextNextOpCodeId == this.OpCodes.MATCH_SEQUENCE;
    if (nextIsPop && (nextNextIsCopy || nextNextIsMatch)) {
        return true;
    }

    // 3.13 literal-only match compilation: sequences of CACHE/LOAD_CONST/COMPARE_OP
    let scan = this.code.Next;
    let steps = 0;
    while (scan && steps < 8) {
        if (scan.OpCodeID == this.OpCodes.COMPARE_OP_A) {
            return true;
        }
        if (scan.OpCodeID == this.OpCodes.LOAD_CONST_A ||
            scan.OpCodeID == this.OpCodes.CACHE ||
            scan.OpCodeID == this.OpCodes.COPY_A ||
            scan.OpCodeID == this.OpCodes.POP_JUMP_IF_FALSE_A) {
            scan = scan.Next;
            steps++;
            continue;
        }
        break;
    }

    let look = this.code.Next;
    steps = 0;
    while (look && steps < 50) {
        if (matchOpcodes.includes(look.OpCodeID) || look.OpCodeID == this.OpCodes.POP_TOP) {
            return true;
        }
        look = look.Next;
        steps++;
    }

    return false;
}

function flushCurrentCaseBody() {
    if (!this.currentCase) {
        return false;
    }

    let startIdx = this.caseBodyStartIndex || 0;
    let bodyNodes = this.curBlock.nodes.slice(startIdx);
    const {guard, bodyNodes: normalized} = extractGuardFromBody(bodyNodes);
    const filtered = normalized.filter(node => !(node instanceof AST.ASTName) && !(node instanceof AST.ASTTuple));

    if (global.g_cliArgs?.debug) {
        const debugNodes = filtered.map(n => `${n?.constructor?.name || typeof n}:${n?.codeFragment ? n.codeFragment() : ''}`);
        console.log(`[MATCH] Case nodes: ${debugNodes.join(' | ')}`);
        if (guard) {
            console.log(`[MATCH] Guard detected: ${guard.codeFragment?.() || guard.constructor?.name}`);
        }
    }

    let body = new AST.ASTNodeList(filtered);
    this.currentCase.m_body = body;
    if (guard) {
        this.currentCase.m_guard = guard;
    }
    this.currentMatch.addCase(this.currentCase);
    this.curBlock.nodes.length = startIdx;
    this.currentCase = null;

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH] Case body recorded with ${filtered.length} node(s)`);
    }

    return true;
}

function beginMatchCaseFromPattern(options = {}) {
    if (!this.currentMatch) {
        return false;
    }

    // Close the previous case body when a new case starts
    flushCurrentCaseBody.call(this);

    const {pattern, remainderOps} = reconstructPattern(this.patternOps);
    this.caseBodyStartIndex = this.curBlock?.nodes?.length || 0;

    const initialGuard = guardFromPatternRemainder(remainderOps);
    this.currentCase = new AST.ASTCase(pattern, null, initialGuard);
    this.currentCase.line = options.line || this.code.Current.LineNo;
    this.inMatchPattern = false;
    this.patternOps = [];

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH] Starting case (${options.reason || 'pop_top'}) at offset ${this.code.Current.Offset}`);
        console.log(`  caseBodyStartIndex=${this.caseBodyStartIndex}`);
    }

    return true;
}

function finalizeMatchCase() {
    if (!this.currentMatch) {
        return false;
    }

    flushCurrentCaseBody.call(this);

    // Normalize guard-only cases that lost their bodies due to literal/guard separation
    const normalizeMatchCases = (matchNode) => {
        if (!matchNode?.cases || matchNode.cases.length < 2) {
            return;
        }
        const wildcardType = AST.ASTPattern.PatternType.Wildcard;
        const cleaned = [];
        for (let i = 0; i < matchNode.cases.length; i++) {
            const cur = matchNode.cases[i];
            const next = matchNode.cases[i + 1];
            const curBodyLen = cur.body?.list?.length || 0;
            const curHasGuard = !!cur.guard;
            const nextIsWildcard = next && next.pattern?.type === wildcardType && !next.guard;
            if (curHasGuard && curBodyLen === 0 && nextIsWildcard) {
                // Move body from wildcard fallback into guarded case
                cur.m_body = next.body;
                i++; // Skip the wildcard case
            }
            // Skip empty wildcard cases (no guard, no body)
            if (cur.pattern?.type === wildcardType && !cur.guard && curBodyLen === 0) {
                continue;
            }
            cleaned.push(cur);
        }
        matchNode.m_cases = cleaned;
    };
    normalizeMatchCases(this.currentMatch);

    if (global.g_cliArgs?.debug) {
        console.log(`[MATCH] Match complete, appending ASTMatch to parent block`);
    }

    if (this.dataStack.length > 0 && this.dataStack.top() === this.matchSubject) {
        this.dataStack.pop();
    }

    let targetBlock = this.matchParentBlock || this.curBlock;

    const preIndex = Math.max(0, this.matchPreNodesStart || 0);
    targetBlock.nodes.length = preIndex;
    targetBlock.append(this.currentMatch);
    this.currentMatch = null;
    this.matchSubject = null;
    this.matchParentBlock = null;
    this.matchPreNodesStart = 0;
    this.caseBodyStartIndex = 0;
    return true;
}

function handleExecStmt() {
    if (this.dataStack.top() instanceof AST.ASTChainStore) {
        this.dataStack.pop();
    }
    let loc = this.dataStack.pop();
    let glob = this.dataStack.pop();
    let stmt = this.dataStack.pop();
    let node = new AST.ASTExec(stmt, glob, loc);
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

function handleFormatValueA() {
    let conversion_flag = this.code.Current.Argument;
    switch (conversion_flag) {
        case AST.ASTFormattedValue.ConversionFlag.None:
        case AST.ASTFormattedValue.ConversionFlag.Str:
        case AST.ASTFormattedValue.ConversionFlag.Repr:
        case AST.ASTFormattedValue.ConversionFlag.ASCII:
        {
            let val = this.dataStack.pop();
            let node = new AST.ASTFormattedValue (val, conversion_flag, null);
            node.line = this.code.Current.LineNo;
            this.dataStack.push(node);
        }
        break;
        case AST.ASTFormattedValue.ConversionFlag.FmtSpec:
        {
            let format_spec = this.dataStack.pop();
            let val = this.dataStack.pop();
            let node = new AST.ASTFormattedValue (val, conversion_flag, format_spec);
            node.line = this.code.Current.LineNo;
            this.dataStack.push(node);
        }
        break;
        default:
            console.error(`Unsupported FORMAT_VALUE_A conversion flag: ${this.code.Current.Argument}\n`);
    }
}

function hasUpcomingStringBuild(context) {
    const lookahead = [
        context.OpCodes.BUILD_STRING_A,
        context.OpCodes.BUILD_INTERPOLATION_A,
        context.OpCodes.BUILD_TEMPLATE
    ];
    const earlyStops = new Set([
        context.OpCodes.RETURN_VALUE,
        context.OpCodes.CALL_A,
        context.OpCodes.CALL_KW_A,
        context.OpCodes.CALL_FUNCTION_EX,
        context.OpCodes.STORE_FAST_A,
        context.OpCodes.STORE_NAME_A,
        context.OpCodes.STORE_GLOBAL_A,
        context.OpCodes.STORE_ATTR_A,
        context.OpCodes.STORE_DEREF_A
    ]);

    for (let step = 1; step <= 12; step++) {
        const instr = context.code.PeekInstructionAtOffset(context.code.Current.Offset + step * 2);
        if (!instr) {
            break;
        }
        if (lookahead.includes(instr.OpCodeID)) {
            return true;
        }
        if (earlyStops.has(instr.OpCodeID)) {
            break;
        }
    }
    return false;
}

function handleFormatSimple() {
    // Python 3.13+ FORMAT_SIMPLE: format TOS without spec (conversion may have been applied by CONVERT_VALUE)
    const val = this.dataStack.pop();

    let node;
    if (val instanceof AST.ASTFormattedValue) {
        node = val;
    } else {
        node = new AST.ASTFormattedValue(
            val,
            AST.ASTFormattedValue.ConversionFlag.None,
            null
        );
        node.line = this.code.Current.LineNo;
    }

    if (!hasUpcomingStringBuild(this)) {
        const joined = new AST.ASTJoinedStr([node]);
        joined.line = node.line;
        this.dataStack.push(joined);
        return;
    }

    this.dataStack.push(node);
}

function handleFormatWithSpec() {
    // Python 3.14 FORMAT_WITH_SPEC: value already converted (optional) + format spec on stack.
    const formatSpec = this.dataStack.pop();
    const val = this.dataStack.pop();

    let target;
    if (val instanceof AST.ASTFormattedValue) {
        target = val;
    } else {
        target = new AST.ASTFormattedValue(val, AST.ASTFormattedValue.ConversionFlag.None, null);
        target.line = this.code.Current.LineNo;
    }
    target.m_format_spec = formatSpec;
    if (!hasUpcomingStringBuild(this)) {
        const joined = new AST.ASTJoinedStr([target]);
        joined.line = target.line;
        this.dataStack.push(joined);
        return;
    }

    this.dataStack.push(target);
}

function handlePopTop() {
    // Match/case: Detect transition from pattern checks to case body
    const readyForWildcard = this.currentMatch && !this.inMatchPattern && (this.patternOps?.length || 0) === 0 && !hasUpcomingMatchCase.call(this);
    if (this.inMatchPattern || readyForWildcard) {
        if (global.g_cliArgs?.debug) {
            console.log(`[POP_TOP] Evaluating match state at offset ${this.code.Current.Offset}, prev=${this.code.Prev?.InstructionName}`);
        }
        // Check if this is the success path (pattern matched)
        // Two scenarios:
        // 1. Sequence patterns: POP_JUMP → UNPACK/etc → POP_TOP (Prev is NOT jump)
        // 2. Literal patterns: POP_JUMP → POP_TOP (Prev IS jump)
        let prevIsJump = [
            this.OpCodes.POP_JUMP_IF_FALSE_A,
            this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
            this.OpCodes.POP_JUMP_IF_TRUE_A,
            this.OpCodes.JUMP_IF_FALSE_A
        ].includes(this.code.Prev?.OpCodeID);

        const patternHasOps = (this.patternOps?.length || 0) > 0;
        let isLiteralPattern = patternHasOps && !this.patternOps.some(op => ["MATCH_SEQUENCE","MATCH_CLASS","MATCH_MAPPING","MATCH_KEYS"].includes(op.type));
        let shouldStartCase = readyForWildcard || !!this.inMatchPattern;
        if (patternHasOps) {
            shouldStartCase = true;
        }
        if (patternHasOps && isLiteralPattern && !prevIsJump) {
            shouldStartCase = false;
        }

        if (shouldStartCase) {
            if (beginMatchCaseFromPattern.call(this, {reason: 'pop_top'})) {
                return;
            }
        } else if (global.g_cliArgs?.debug) {
            console.log(`[POP_TOP] Skipping case start at offset ${this.code.Current.Offset} (literal=${isLiteralPattern}, prevIsJump=${prevIsJump})`);
            console.log(`  patternOps=${JSON.stringify(this.patternOps.map(op => op.type))}`);
        }
        // Consume POP_TOP related to match even if no case starts
        if (this.dataStack.length > 0) {
            this.dataStack.pop();
        }
        return;
    }

    if (!(this.dataStack.top() instanceof AST.ASTComprehension) && [this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A, this.OpCodes.POP_JUMP_IF_FALSE_A, this.OpCodes.JUMP_IF_FALSE_A].includes(this.code.Prev?.OpCodeID)) {
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except) {
            // Skipping POP_TOP, POP_TOP, POP_TOP
            if ([this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Prev.OpCodeID)) {
                if (this.code.Next?.OpCodeID == this.OpCodes.POP_TOP && this.code.Next?.Next?.OpCodeID == this.OpCodes.POP_TOP) {
                    this.code.GoNext(2);
                }
            } else if (this.code.Prev.OpCodeID == this.OpCodes.POP_JUMP_IF_FALSE_A) {
                if ([this.OpCodes.STORE_NAME_A, this.OpCodes.STORE_FAST_A].includes(this.code.Next?.OpCodeID) && this.code.Next?.Next?.OpCodeID == this.OpCodes.POP_TOP) {
                    let exceptionTypeNode = this.curBlock.condition;
                    if (!(exceptionTypeNode instanceof AST.ASTName)) {
                        console.error(`Expected ASTName, but got ${exceptionTypeNode.constructor.name}`);
                        return;
                    }
                    let exceptionName = new AST.ASTName(this.code.Next.Name);
                    exceptionName.line = this.code.Current.LineNo;
                    this.curBlock.condition = new AST.ASTStore(exceptionTypeNode, exceptionName);
                    this.code.GoNext(2);
                }
            } else if (this.code.Prev.OpCodeID == this.OpCodes.JUMP_IF_FALSE_A) {
                if ( this.code.Next?.OpCodeID == this.OpCodes.POP_TOP && [this.OpCodes.STORE_NAME_A, this.OpCodes.STORE_FAST_A].includes(this.code.Next?.Next?.OpCodeID) && this.code.Next?.Next?.Next?.OpCodeID == this.OpCodes.POP_TOP) {
                    let exceptionTypeNode = this.curBlock.condition;
                    if (!(exceptionTypeNode instanceof AST.ASTName)) {
                        console.error(`Expected ASTName, but got ${exceptionTypeNode.constructor.name}`);
                        return;
                    }
                    let exceptionName = new AST.ASTName(this.code.Next.Next.Name);
                    exceptionName.line = this.code.Current.LineNo;
                    this.curBlock.condition = new AST.ASTStore(exceptionTypeNode, exceptionName);
                    this.code.GoNext(2);
                }
            }
        }
        return;
    } else if ([this.OpCodes.PRINT_ITEM_TO].includes(this.code.Prev.OpCodeID) && this.curBlock.nodes.top() instanceof AST.ASTPrint) {
        let printNode = this.curBlock.nodes.top();
        if (printNode.stream && printNode.stream == this.dataStack.top()) {
            this.dataStack.pop();
            return;
        }
    }
    let value = this.dataStack.pop();
    if (this.appendExceptionExprs && this.curBlock.blockType == AST.ASTBlock.BlockType.Except) {
        // direct expression in handler (e.g., add_note call result is discarded)
        if (value && !(value instanceof AST.ASTNone)) {
            this.curBlock.append(value);
        }
        return;
    }
    if (!this.curBlock.inited) {
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.With) {
            this.curBlock.expr = value;
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.If && !this.curBlock.condition) {
            this.curBlock.condition = value;
        }
        // Don't initialize For/AsyncFor blocks here - they are initialized by STORE_FAST/STORE_NAME when setting the index
        if (this.curBlock.blockType != AST.ASTBlock.BlockType.For &&
            this.curBlock.blockType != AST.ASTBlock.BlockType.AsyncFor) {
            this.curBlock.init();
        }
    } else if (value == null || value.processed) {
        return;
    }

    if (!(value instanceof AST.ASTObject)) {
        this.curBlock.append(value);
    }

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.For
            && this.curBlock.comprehension) {
        /* This relies on some really uncertain logic...
            * If it's a comprehension, the only POP_TOP should be
            * a call to append the iter to the list.
            */
        if (value instanceof AST.ASTCall) {
            let pparams = value.pparams;
            if (!pparams.empty()) {
                let res = pparams[0];
                let node = new AST.ASTComprehension (res);
                node.line = this.code.Current.LineNo;
                this.dataStack.push(node);
            }
        }
    }
}

function handlePrintExpr() {
    processPrint.call(this);
}

function handlePrintItem() {
    processPrint.call(this);
}

function processPrint() {
    let printNode;
    if (this.curBlock.nodes.length > 0 && this.curBlock.nodes.top() instanceof AST.ASTPrint) {
        printNode = this.curBlock.nodes.top();
    }
    if (printNode && printNode.stream == null && !printNode.eol) {
        printNode.add(this.dataStack.pop());
    } else {
        let node = new AST.ASTPrint(this.dataStack.pop());
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }
}

function handlePrintItemTo() {
    let stream = this.dataStack.pop();
    let printNode;

    if (this.curBlock.nodes.length > 0 && this.curBlock.nodes.top() instanceof AST.ASTPrint) {
        printNode = this.curBlock.nodes.top();
    }

    if (printNode && printNode.stream == stream && !printNode.eol) {
        printNode.add(this.dataStack.pop());
    } else {
        let node = new AST.ASTPrint(this.dataStack.pop(), stream);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }
}

function handlePrintNewline() {
    let printNode;
    if (!this.curBlock.empty() && this.curBlock.nodes.top() instanceof AST.ASTPrint)
        printNode = this.curBlock.nodes.top();
    if (printNode && printNode.stream == null && !printNode.eol)
        printNode.eol = true;
    else {
        let node = new AST.ASTPrint();
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }
    this.dataStack.pop();
}

function handlePrintNewlineTo() {
    let stream = this.dataStack.pop();

    let printNode;
    if (!this.curBlock.empty() && this.curBlock.nodes.top() instanceof AST.ASTPrint) {
        printNode = this.curBlock.nodes.top();
    }

    if (printNode && printNode.stream == stream && !printNode.eol) {
        printNode.eol = true;
    } else {
        let node = new AST.ASTPrint(null, stream);
        node.line = this.code.Current.LineNo;
        this.curBlock.append(node);
    }
    this.dataStack.pop();
}

function handleReturnGenerator() {
    // Python 3.11+ RETURN_GENERATOR opcode
    // Appears at the start of generator/async generator functions
    // Creates the generator object - no action needed in decompiler
    if (global.g_cliArgs?.debug) {
        console.log(`[RETURN_GENERATOR] at offset ${this.code.Current.Offset} - generator function detected`);
    }
}

function handleInstrumentedReturnValueA() {
    this.handleReturnValue();
}

function handleReturnValue() {
    if (this.currentMatch) {
        // Only start new case if no current case AND (not in pattern OR has unflushed pattern ops)
        const hasUnflushedPattern = (this.patternOps?.length || 0) > 0;
        const needsNewCase = !this.currentCase && (!this.inMatchPattern || hasUnflushedPattern);
        if (needsNewCase) {
            beginMatchCaseFromPattern.call(this, {reason: 'return'});
        }
    }

    // CRITICAL: Close blocks that have ended before processing return
    // Return statements often appear at block boundaries
    while (this.curBlock.end > 0 &&
           this.curBlock.end <= this.code.Current.Offset &&
           this.curBlock.blockType != AST.ASTBlock.BlockType.Main &&
           this.blocks.length > 1) {

        if (global.g_cliArgs?.debug) {
            console.log(`[handleReturnValue] Closing ended block ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}) at offset ${this.code.Current.Offset}`);
        }

        let closedBlock = this.blocks.pop();
        this.curBlock = this.blocks.top();
        this.curBlock.append(closedBlock);

        if (global.g_cliArgs?.debug) {
            console.log(`  → Appended to ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}), now has ${this.curBlock.nodes.length} nodes`);
        }
    }

    // 3.12 exception-group prolog sometimes leaves synthetic None; drop only if it's a synthetic None before PUSH_EXC_INFO.
    let value = this.dataStack.pop();
    const nextOp = this.code.Next;
    // Only drop return if it's a synthetic None followed by PUSH_EXC_INFO (exception-group prolog pattern).
    // Real returns before exception handlers (like in with-statements) should NOT be dropped.
    if (value instanceof AST.ASTNone && nextOp?.OpCodeID === this.OpCodes.PUSH_EXC_INFO) {
        // Check if this is a synthetic return (no explicit line number or same line as previous instruction)
        const curLine = this.code.Current?.LineNo;
        const prevLine = this.code.Previous?.LineNo;
        if (curLine === prevLine || !curLine) {
            // Likely synthetic None from exception prolog - drop it
            return;
        }
    }
    if (value == null) {
        value = new AST.ASTNone();
    }
    let node = new AST.ASTReturn(value);
    node.inLambda = this.object.Name == '<lambda>';
    node.line = this.code.Current.LineNo;

    this.curBlock.append(node);

    if (this.currentMatch) {
        const hasDefaultAhead = (() => {
            let scan = this.code.Next;
            let steps = 0;
            const retOps = [this.OpCodes.RETURN_CONST_A, this.OpCodes.RETURN_VALUE, this.OpCodes.RETURN_VALUE_A];
            const skipOps = [this.OpCodes.CACHE, this.OpCodes.NOP];
            while (scan && steps < 4) {
                if (retOps.includes(scan.OpCodeID)) return true;
                if (skipOps.includes(scan.OpCodeID)) { scan = scan.Next; steps++; continue; }
                break;
            }
            return false;
        })();
        if (!hasDefaultAhead && !hasUpcomingMatchCase.call(this)) {
            finalizeMatchCase.call(this);
            return;
        }
    }

    if (!this.currentCase && [AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Else].includes(this.curBlock.blockType)
        && (this.object.Reader.versionCompare(2, 6) >= 0)) {
        let prev = this.curBlock;
        this.blocks.pop();
        this.curBlock = this.blocks.top();
        if (
            prev instanceof AST.ASTCondBlock &&
            prev.nodes.length == 1 &&
            prev.line == value.line
        ) {
            prev = new AST.ASTReturn(new AST.ASTBinary(prev.condition, value, prev.negative ? AST.ASTBinary.BinOp.LogicalOr : AST.ASTBinary.BinOp.LogicalAnd));
        }

        this.curBlock.append(prev);

        if ([this.OpCodes.JUMP_ABSOLUTE_A, this.OpCodes.JUMP_FORWARD_A].includes(this.code.Next?.OpCodeID)) {
            this.code.GoNext();
        }
    }
}

function handleInstrumentedReturnConstA() {
    this.handleReturnConstA();
}

function handleReturnConstA() {
    // If a new pattern matched but case body not started yet, open it now
    // Only start new case if no current case AND (not in pattern OR has unflushed pattern ops)
    if (this.currentMatch) {
        const hasUnflushedPattern = (this.patternOps?.length || 0) > 0;
        const needsNewCase = !this.currentCase && (!this.inMatchPattern || hasUnflushedPattern);
        if (needsNewCase) {
            beginMatchCaseFromPattern.call(this, {reason: 'return'});
        }
    }

    const nextOp = this.code.Next;
    if (nextOp?.OpCodeID === this.OpCodes.PUSH_EXC_INFO) {
        return;
    }

    let value = new AST.ASTObject(this.code.Current.ConstantObject);
    let node = new AST.ASTReturn(value);
    node.line = this.code.Current.LineNo;

    this.curBlock.append(node);

    if (this.currentMatch) {
        const hasDefaultAhead = (() => {
            let scan = this.code.Next;
            let steps = 0;
            const retOps = [this.OpCodes.RETURN_CONST_A, this.OpCodes.RETURN_VALUE, this.OpCodes.RETURN_VALUE_A];
            const skipOps = [this.OpCodes.CACHE, this.OpCodes.NOP];
            while (scan && steps < 4) {
                if (retOps.includes(scan.OpCodeID)) return true;
                if (skipOps.includes(scan.OpCodeID)) { scan = scan.Next; steps++; continue; }
                break;
            }
            return false;
        })();
        if (hasDefaultAhead) {
            // Default case ahead - flush current case before default starts
            if (this.currentCase) {
                flushCurrentCaseBody.call(this);
            }
            return;
        }
        if (!hasUpcomingMatchCase.call(this)) {
            finalizeMatchCase.call(this);
            return;
        }
        // More cases coming - flush current case before next one starts
        if (this.currentCase) {
            flushCurrentCaseBody.call(this);
        }
    }

}

function handleSetLinenoA() {}

function handleSetupAnnotations() {
    this.variable_annotations = true;
}

function handleEndAsyncFor() {
    // Python 3.9+ END_ASYNC_FOR opcode
    // Python 3.9-3.10: finally handler for SETUP_FINALLY in async for loops
    // Python 3.11+: direct exception handler (no CONTAINER/finally wrapper)

    if (global.g_cliArgs?.debug) {
        console.log(`[END_ASYNC_FOR] curBlock=${this.curBlock.type_str}, stack depth=${this.blocks.length}`);
        console.log(`  Block stack: ${this.blocks.map((b,i) => `[${i}]${b.type_str}`).join(' → ')}`);
    }

    // Python 3.11+: Direct async for block (no CONTAINER)
    if (this.object.Reader.versionCompare(3, 11) >= 0 &&
        this.curBlock.blockType == AST.ASTBlock.BlockType.AsyncFor) {

        if (global.g_cliArgs?.debug) {
            console.log(`  Python 3.11+ direct AsyncFor, nodes: ${this.curBlock.nodes.length}`);
        }

        // If body is empty, add pass
        if (this.curBlock.nodes.length === 0) {
            let passNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Pass);
            passNode.line = this.code.Current.LineNo;
            this.curBlock.nodes.push(passNode);

            if (global.g_cliArgs?.debug) {
                console.log(`  ✓ Added pass statement to empty Python 3.11 async for body`);
            }
        }

        // Close the async for block
        this.blocks.pop();
        this.blocks.top().append(this.curBlock);
        this.curBlock = this.blocks.top();

        if (global.g_cliArgs?.debug) {
            console.log(`  ✓ Closed Python 3.11 AsyncFor block`);
        }

        return;
    }

    // Python 3.9-3.10: CONTAINER/finally pattern
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Finally) {
        let finallyBlock = this.curBlock;

        // Pop the finally block
        this.blocks.pop();
        this.curBlock = this.blocks.top();

        // Check if we're in CONTAINER → AsyncFor pattern
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container &&
            this.blocks.length > 1) {
            let cont = this.curBlock;
            let parentBlock = this.blocks[this.blocks.length - 2];

            if (parentBlock.blockType == AST.ASTBlock.BlockType.AsyncFor &&
                parentBlock.inited) {

                if (global.g_cliArgs?.debug) {
                    console.log(`  Found CONTAINER→AsyncFor(inited), hiding CONTAINER`);
                    console.log(`  AsyncFor has ${parentBlock.nodes.length} nodes, Finally has ${finallyBlock.nodes.length} nodes`);
                }

                // Extract loop body from finally block (Python 3.9 uses finally, not try)
                // Skip STORE (index already set by processStore) and skip async implementation details
                for (let i = 0; i < finallyBlock.nodes.length; i++) {
                    let node = finallyBlock.nodes[i];
                    // Skip implementation details: STORE, yield from, await calls
                    if (node &&
                        !(node instanceof AST.ASTStore) &&
                        node.constructor.name !== 'ASTReturn' &&
                        !(node.constructor.name === 'ASTCall' && node.func?.name === 'await')) {
                        parentBlock.nodes.push(node);
                    }
                }

                // If body is empty, add pass
                if (parentBlock.nodes.length === 0) {
                    let passNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Pass);
                    passNode.line = finallyBlock.line;
                    parentBlock.nodes.push(passNode);

                    if (global.g_cliArgs?.debug) {
                        console.log(`  ✓ Added pass statement to empty async for body`);
                    }
                }

                // Pop CONTAINER without appending it
                this.blocks.pop();
                this.curBlock = this.blocks.top();

                // Close AsyncFor early and mark rest as unreachable
                if (this.curBlock.blockType == AST.ASTBlock.BlockType.AsyncFor) {
                    let asyncForEnd = this.curBlock.end;
                    this.blocks.pop();
                    this.blocks.top().append(this.curBlock);
                    this.curBlock = this.blocks.top();

                    // Mark everything until the original AsyncFor end as unreachable
                    this.unreachableUntil = asyncForEnd;

                    if (global.g_cliArgs?.debug) {
                        console.log(`  ✓ Closed AsyncFor, marking ${this.code.Current.Offset}-${asyncForEnd} as unreachable`);
                    }
                }
                return;
            }
        }
    }
}

function handleInstrumentedEndAsyncForA() {
    // Instrumented variant mirrors END_ASYNC_FOR behavior.
    handleEndAsyncFor.call(this);
}

function handleInstrumentedInstructionA() {
    // Instrumentation hook; no AST impact.
    if (global.g_cliArgs?.debug) {
        console.log(`[INSTRUMENTED_INSTRUCTION] at offset ${this.code.Current.Offset}`);
    }
}

function handleInstrumentedLineA() {
    // Line profiling hook; skip for decompilation.
    if (global.g_cliArgs?.debug) {
        console.log(`[INSTRUMENTED_LINE] at offset ${this.code.Current.Offset}`);
    }
}

module.exports = {
    beginMatchCaseFromPattern,
    flushCurrentCaseBody,
    handleExecStmt,
    handleFormatValueA,
    handleFormatSimple,
    handleFormatWithSpec,
    handlePopTop,
    handlePrintExpr,
    handlePrintItem,
    handlePrintItemTo,
    handlePrintNewline,
    handlePrintNewlineTo,
    handleReturnGenerator,
    handleInstrumentedReturnValueA,
    handleReturnValue,
    handleInstrumentedReturnConstA,
    handleReturnConstA,
    handleSetLinenoA,
    handleSetupAnnotations,
    handleEndAsyncFor,
    handleInstrumentedEndAsyncForA,
    handleInstrumentedInstructionA,
    handleInstrumentedLineA
};

function extractGuardFromBody(nodes) {
    if (!nodes || nodes.length === 0) {
        return {guard: null, bodyNodes: []};
    }

    if (global.g_cliArgs?.debug) {
        const raw = nodes.map(n => `${n?.constructor?.name || typeof n}:${n?.codeFragment ? n.codeFragment() : ''}`);
        console.log(`[MATCH] Raw case nodes: ${raw.join(' | ')}`);
    }

    let guard = null;
    let working = nodes.slice();
    const prefix = [];
    while (working.length > 0 && working[0] instanceof AST.ASTStore) {
        prefix.push(working.shift());
    }

    if (working.length === 1 && working[0] instanceof AST.ASTCondBlock &&
        working[0].blockType == AST.ASTBlock.BlockType.If && !working[0].negative &&
        !(working[0].nextSibling instanceof AST.ASTBlock)) {
        guard = working[0].condition;
        working = prefix.concat(working[0].nodes || []);
    } else {
        working = nodes.slice();
    }

    return {guard, bodyNodes: working};
}

function guardFromPatternRemainder(remainderOps) {
    if (!remainderOps || remainderOps.length === 0) {
        return null;
    }

    const compareOps = remainderOps.filter(op => op.type === 'COMPARE');
    if (compareOps.length === 0) {
        return null;
    }

    let guardExpr = null;

    for (const comp of compareOps) {
        const compareNode = new AST.ASTCompare(comp.left, comp.right, comp.op);
        if (guardExpr) {
            guardExpr = new AST.ASTBinary(guardExpr, compareNode, AST.ASTBinary.BinOp.LogicalAnd);
        } else {
            guardExpr = compareNode;
        }
    }

    return guardExpr;
}
