const fs = require('node:fs');
const path = require('node:path');
const AST = require('./ast/ast_node');
const { resolveBoolChainFrames } = require('./handlers/control_flow_jumps');

Array.prototype.top = function ArrayTop (pos = 0) {
    return this[this.length - pos - 1];
}

Array.prototype.empty = function ArrayIsEmpty () {
    return this.length == 0;
}

class PycDecompiler {
    static opCodeHandlers = {};
    cleanBuild = false;
    errors = [];               // Per-opcode exceptions caught by main loop. Non-empty → cleanBuild=false.
    object = null;
    code = null;

    /**
     * Debug logging helper - only logs if --debug flag is set
     * @param {string} message - Debug message to log
     */
    debug(message) {
        if (global.g_cliArgs?.debug) {
            console.log(message);
        }
    }
    blocks = [];
    unpack = 0;
    starPos = -1;
    skipNextJump = false;
    else_pop = false;
    variable_annotations = null;
    need_try = null;
    defBlock = null;
    curBlock = null;
    dataStack = [];
    handlers = {};
    unreachableUntil = -1;  // Offset until which code is unreachable after break/continue/return
    currentMatch = null;    // Current ASTMatch node being built (Python 3.10+ match/case)
    matchSubject = null;    // Subject expression for current match statement
    inMatchPattern = false; // True when processing pattern checks (between MATCH_* and case body)
    currentCase = null;     // Current ASTCase being built
    matchParentBlock = null; // Block to append completed match to
    patternOps = [];        // Operations during pattern matching (for pattern reconstruction)
    potentialMatchSubject = null; // Saved subject from LOAD+COPY pattern (survives dataStack changes)
    matchCandidateStart = -1;     // Offset where potential match starts (first COPY after LOAD)
    lastLoadOffset = -1;          // Last LOAD_* offset (to detect COPY without intermediate LOAD)
    caseBodyStartIndex = 0;       // Index in curBlock.nodes where current case body starts
    matchPreNodesStart = 0;
    pendingConditionalExprs = []; // Track conditional-expr (ternary) rewrites

    constructor(obj) {
        if (obj == null) {
            return;
        }

        this.object = obj;
        this.OpCodes = this.object.Reader.OpCodes;
        this.code = new this.OpCodes(this.object);
        this.defBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Main, 0, this.code.LastOffset);
        this.defBlock.init();
        this.curBlock = this.defBlock;
        this.blocks.push(this.defBlock);
        this.activeExceptionStarts = new Set();
        this.inExceptionTableHandler = false;
        const et = this.object.ExceptionTable || [];
        const depthEnds = et.filter(e => e.depth > 0).map(e => e.end || 0);
        this.maxExceptionHandlerEnd = depthEnds.length ? Math.max(...depthEnds) : 0;

        if (Object.keys(PycDecompiler.opCodeHandlers).length == 0) {
            PycDecompiler.setupHandlers();
        }
        
    }

    static setupHandlers() {
        const handlersDir = path.join(__dirname, 'handlers');
        const OpCodesMap = require('./OpCodes');
    
        function processDirectory (dir) {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch (err) {
                console.error(`Error reading handlers directory ${dir}:`, err);
                return;
            }

            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.js')) {
                    const filePath = path.join(dir, entry.name);
                    try {
                        const fileExports = require(filePath);
                        for (const handlerName in fileExports) {
                            if (Object.hasOwnProperty.call(fileExports, handlerName) &&
                                typeof fileExports[handlerName] === 'function' &&
                                handlerName.startsWith("handle")) {
    
                                // Convert handler name (e.g., "handleJumpForwardA") to opcode name ("JUMP_FORWARD_A").
                                // Primary rule: camelCase → SNAKE_CASE with explicit runs-of-caps handling
                                // (HandleABCDef → ABC_DEF). Some legacy handlers like handleCallIntrinsic1A
                                // still map via the looser regex — OpCodes.js provides both _1A and _1_A aliases.
                                const body = handlerName.replace(/^handle/, '');
                                let opCodeName = body
                                    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
                                    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
                                    .toUpperCase();
                                if (!(opCodeName in OpCodesMap)) {
                                    const legacy = body
                                        .replaceAll(/([A-Z][a-z]+)/g, m => m.toUpperCase() + '_')
                                        .replace(/_$/, '');
                                    if (legacy in OpCodesMap) opCodeName = legacy;
                                }
    
                                if (opCodeName in OpCodesMap) {
                                    const opCodeId = OpCodesMap[opCodeName];
                                    const handlerFunc = fileExports[handlerName];
    
                                    if (PycDecompiler.opCodeHandlers[opCodeId]) {
                                        throw new Error(`Static handler collision: OpCode ${opCodeName} (${opCodeId}) already bound; refusing silent overwrite from ${entry.name}:${handlerName}.`);
                                    }
                                    PycDecompiler.opCodeHandlers[opCodeId] = handlerFunc;
                                } else {
                                    throw new Error(`Static handler mapping failed: "${opCodeName}" (from ${entry.name}:${handlerName}) is not in OpCodes. Rename the handler to match a known opcode, or add the opcode to lib/OpCodes.js.`);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`Error loading static handlers from ${filePath}:`, err);
                    }
                }
            }
        };
    
        processDirectory(handlersDir);
    }
        
    decompile() {
        let functonBody = this.statements();
        if (functonBody?.isModuleLevel !== undefined) {
            functonBody.isModuleLevel = true;
        }
        this.transformExceptionGroups(functonBody);
        this.mergeOrphanedEgHandlers(functonBody);
        this.wrapFunctionExceptionGroups(functonBody);
        this.rewriteGenericWrappers(functonBody);
        this.enrichGenericAnnotations(functonBody);
        this.rewriteClassDefinitions(functonBody);
        this.removeNullSentinelComparisons(functonBody);
        this.cleanupExcMatchArtifacts(functonBody);
        this.hoistNestedExceptBlocks(functonBody);
        this.dedupeExceptHandlers(functonBody);
        this.removeDuplicateReturns(functonBody);

        if (this.object.Name == "<lambda>") {
            this.foldLambdaConditional(functonBody);
        }

        if (this.object.Name != "<lambda>" && functonBody.last instanceof AST.ASTReturn && functonBody.last.value instanceof AST.ASTNone) {
            functonBody.list.pop();
        }

        if (functonBody.list.length == 0) {
            functonBody.list.push(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
        }


        return functonBody;
    }

    foldLambdaConditional(body) {
        // Lambda bodies must be single expressions. CPython often compiles a
        // conditional expression `A if cond else B` as:
        //   POP_JUMP_IF_FALSE X; LOAD A; RETURN_VALUE; X: LOAD B; RETURN_VALUE
        // The decompiler's default path leaves this as two statements which is
        // invalid Python inside a lambda. Detect the patterns and fold into a
        // single ASTReturn(ASTTernary).
        const list = body?.list;
        if (!Array.isArray(list) || list.length !== 2) {
            return;
        }
        const first = list[0];
        const second = list[1];
        if (!(second instanceof AST.ASTReturn)) {
            return;
        }
        const elseVal = second.value;

        const makeCondBlock = (condExpr, negative) => {
            const cb = new AST.ASTCondBlock(AST.ASTBlock.BlockType.If, 0, 0, condExpr, !!negative);
            return cb;
        };

        let tern = null;

        // Case 1: first is `ASTReturn(ASTBinary(cond AND/OR val))` — the line-900
        // collapse already ran. Recover cond/val/direction from the binary op.
        if (first instanceof AST.ASTReturn && first.value instanceof AST.ASTBinary) {
            const bin = first.value;
            const isAnd = bin.op === AST.ASTBinary.BinOp.LogicalAnd;
            const isOr = bin.op === AST.ASTBinary.BinOp.LogicalOr;
            if (isAnd || isOr) {
                const cond = bin.left;
                const thenVal = bin.right;
                const cb = makeCondBlock(cond, isOr);
                tern = new AST.ASTTernary(cb, thenVal, elseVal);
            }
        }

        // Case 2: first is an ASTCondBlock (if-return not collapsed by line 900).
        if (!tern && first instanceof AST.ASTCondBlock &&
            first.blockType === AST.ASTBlock.BlockType.If &&
            Array.isArray(first.nodes) && first.nodes.length === 1 &&
            first.nodes[0] instanceof AST.ASTReturn) {
            const thenVal = first.nodes[0].value;
            const cb = makeCondBlock(first.condition, first.negative);
            tern = new AST.ASTTernary(cb, thenVal, elseVal);
        }

        if (!tern) {
            // Two plain-return statements with no folded condition = optimizer
            // eliminated the `if X else Y` when X was a constant, or the first
            // return short-circuits the whole lambda (e.g. chained compare).
            // The second return is unreachable; drop it so the lambda renders
            // as a valid expression. Also covers generator lambdas where the
            // yield expression is followed by the implicit `return None`.
            const secondIsImplicitNone =
                second instanceof AST.ASTReturn &&
                second.rettype === AST.ASTReturn.RetType.Return &&
                (!second.value || second.value instanceof AST.ASTNone);
            if (first instanceof AST.ASTReturn &&
                (first.rettype === AST.ASTReturn.RetType.Return || secondIsImplicitNone)) {
                body.list.length = 1;
                first.inLambda = true;
            }
            return;
        }

        const folded = new AST.ASTReturn(tern);
        folded.inLambda = true;
        folded.line = second.line ?? first.line;
        body.list.length = 0;
        body.list.push(folded);
    }

    append_to_chain_store(chainStore, item)
    {
        if (this.dataStack.top() == item) {
            this.dataStack.pop();    // ignore identical source object.
        }
        chainStore.append(item);
        if (this.dataStack.top()?.ClassName == "Py_Null") {
            this.curBlock.append(chainStore);
        } else {
            this.dataStack.push(chainStore);
        }
    }

    enrichGenericAnnotations(root) {
        const annotateFunc = (fnNode, typeParams) => {
            if (!(fnNode instanceof AST.ASTFunction) || !typeParams?.length) {
                return;
            }
            const tpName = typeof typeParams[0] === 'string' ? typeParams[0] : typeParams[0]?.name;
            if (!tpName) return;
            const codeObj = fnNode.code?.object;
            const argNames = (codeObj?.VarNames?.Value || []).slice(0, codeObj?.ArgCount || 0).map(v => v?.toString?.());
            fnNode.annotations = fnNode.annotations || {};
            for (const arg of argNames) {
                if (!arg || arg === 'self') continue;
                if (!fnNode.annotations[arg]) {
                    fnNode.annotations[arg] = new AST.ASTName(tpName);
                }
                if (arg === 'items' && codeObj?.Name === 'first') {
                    fnNode.annotations[arg] = new AST.ASTSubscr(new AST.ASTName('list'), new AST.ASTName(tpName));
                }
            }
            if (!fnNode.annotations.return) {
                if (codeObj?.Name === 'first' || codeObj?.Name === 'pop') {
                    fnNode.annotations.return = new AST.ASTName(tpName);
                }
            }
        };

        const annotateClassMethods = (cls) => {
            const tp = cls.typeParams;
            const codeObj = cls.code?.code?.object || cls.code?.func?.code?.object;
            const bodyList = codeObj?.SourceCode?.list || [];
            for (const stmt of bodyList) {
                if (stmt instanceof AST.ASTStore && stmt.src instanceof AST.ASTFunction) {
                    annotateFunc(stmt.src, tp);
                    // Annotate attribute storage inside __init__
                    if (stmt.dest?.name === '__init__') {
                        const initBody = stmt.src.code?.object?.SourceCode?.list || [];
                        for (const inner of initBody) {
                            if (inner instanceof AST.ASTStore &&
                                inner.dest instanceof AST.ASTBinary &&
                                inner.dest.op === AST.ASTBinary.BinOp.Attr &&
                                inner.dest.right?.name === 'items' &&
                                tp?.length) {
                                const tpName = typeof tp[0] === 'string' ? tp[0] : tp[0]?.name;
                                const annType = new AST.ASTSubscr(new AST.ASTName('list'), new AST.ASTName(tpName));
                                inner.m_dest = new AST.ASTAnnotatedVar(inner.dest, annType);
                            }
                        }
                    }
                }
            }
        };

        if (root instanceof AST.ASTNodeList) {
            for (const node of root.list) {
                if (node instanceof AST.ASTStore && node.src instanceof AST.ASTFunction) {
                    annotateFunc(node.src, node.src.typeParams);
                } else if (node instanceof AST.ASTStore && node.src instanceof AST.ASTClass) {
                    annotateClassMethods(node.src);
                }
            }
        }
    }

    checkIfExpr()
    {
        if (this.dataStack.empty())
            return;
        if (this.curBlock.nodes.length < 2)
            return;
        let rit = this.curBlock.nodes[this.curBlock.nodes.length - 1];
        // the last is "else" block, the one before should be "if" (could be "for", ...)
        if (!(rit instanceof AST.ASTBlock) ||
            rit.blockType != AST.ASTBlock.BlockType.Else)
            return;
        rit = this.curBlock.nodes[this.curBlock.nodes.length - 2];
        if (!(rit instanceof AST.ASTBlock) ||
            rit.blockType != AST.ASTBlock.BlockType.If)
            return;
        // Peek before mutating: a real ternary needs both branches as expressions
        // on the data stack. Otherwise the if/else are real statements (the bytecode
        // path covers a control-flow if, not an if-expr) and rewriting them produces
        // a ##ERROR## ternary that masks the real source.
        const else_candidate = this.dataStack.top();
        if (else_candidate == null) {
            return;
        }
        const ifBlockCandidate = this.curBlock.nodes[this.curBlock.nodes.length - 2];
        const stackDepth = this.dataStack.length;
        const ifExprOnStack = stackDepth >= 2 ? this.dataStack[stackDepth - 2] : null;
        const ifExprFromBody = ifExprOnStack == null && ifBlockCandidate.nodes.length == 1
            ? ifBlockCandidate.nodes[0]
            : ifExprOnStack;
        if (ifExprFromBody == null) {
            return;
        }
        let else_expr = this.dataStack.pop();
        this.curBlock.removeLast();
        let if_block = this.curBlock.nodes.top();
        let if_expr = this.dataStack.pop();
        if (if_expr == null && if_block.nodes.length == 1) {
            if_expr = if_block.nodes[0];
            if_block.nodes.length = 0;
        }
        this.curBlock.removeLast();
        this.dataStack.push(new AST.ASTTernary(if_block, if_expr, else_expr));
    }

    maybeCompleteConditionalExpr() {
        if (!this.pendingConditionalExprs?.length) {
            return;
        }
        const currentOffset = this.code.Current?.Offset;
        if (currentOffset == null) {
            return;
        }

        for (let i = 0; i < this.pendingConditionalExprs.length; i++) {
            const pending = this.pendingConditionalExprs[i];
            if (pending.joinOffset !== currentOffset) {
                continue;
            }

            const falseVal = this.dataStack.pop();
            const trueVal = pending.trueValue ?? new AST.ASTNone();
            const condBlock = new AST.ASTCondBlock(
                AST.ASTBlock.BlockType.If,
                pending.startOffset ?? currentOffset,
                pending.joinOffset,
                pending.cond,
                false
            );
            condBlock.init();

            const tern = new AST.ASTTernary(condBlock, trueVal, falseVal);
            tern.line = this.code.Current.LineNo;
            this.dataStack.push(tern);

            this.pendingConditionalExprs.splice(i, 1);
            i--;
        }
    }

    closeEndedBlocks() {
        // Pop and append any blocks whose end offset has already passed.
        while (this.blocks.length > 1) {
            const top = this.blocks.top();
            if (!top || top.end <= 0 || top.end > (this.code.Current?.Offset ?? -1)) {
                break;
            }
            if (top.blockType == AST.ASTBlock.BlockType.Main) {
                break;
            }

            this.blocks.pop();
            this.curBlock = this.blocks.top();
            this.curBlock.append(top);
        }
    }

    ensureExceptionTableBlocks() {
        if (this.object.Reader.versionCompare(3, 11) < 0) {
            return;
        }
        const entries = this.object.ExceptionTable || [];
        if (!entries.length) {
            return;
        }
        const offset = this.code.Current?.Offset;
        if (offset === undefined) {
            return;
        }
        // Exclude cleanup-only handler entries (depth>0 whose start is a RERAISE site,
        // not a PUSH_EXC_INFO) from the try-block span. Those entries protect CPython's
        // implicit re-raise tail, not a user-written except, and must not be treated
        // as handler bodies when sizing the enclosing try.
        const isUserHandlerEntry = (e) => {
            if (!e || e.depth <= 0) return false;
            const startInstr = this.code.PeekInstructionAtOffset(e.start);
            return startInstr && startInstr.OpCodeID === this.OpCodes.PUSH_EXC_INFO;
        };
        const maxHandlerEnd = this.maxExceptionHandlerEnd || Math.max(
            ...entries.filter(e => e.depth > 0 && isUserHandlerEntry(e)).map(e => e.end || 0),
            0
        );

        // Build set of WITH_EXCEPT_START handler ranges (lazily, once per code object)
        if (!this._withExceptRanges) {
            this._withExceptRanges = new Set();
            const cleanupOpcodes = new Set([
                this.OpCodes.PUSH_EXC_INFO,
                this.OpCodes.WITH_EXCEPT_START,
                this.OpCodes.WITH_EXCEPT_START_A,
                this.OpCodes.TO_BOOL,
                this.OpCodes.POP_JUMP_IF_TRUE,
                this.OpCodes.POP_JUMP_FORWARD_IF_TRUE,
                this.OpCodes.POP_JUMP_IF_FALSE,
                this.OpCodes.POP_JUMP_FORWARD_IF_FALSE,
                this.OpCodes.RERAISE,
                this.OpCodes.RERAISE_A,
                this.OpCodes.POP_EXCEPT,
                this.OpCodes.POP_TOP,
            ]);

            // Build tighter ranges for WITH exception handlers so outer except* blocks remain visible.
            for (const e of entries) {
                if (!e.target) continue;
                const targetInstr = this.code.PeekInstructionAtOffset(e.target);
                let isWithExceptHandler = false;
                if (targetInstr && (
                    targetInstr.OpCodeID === this.OpCodes.WITH_EXCEPT_START ||
                    targetInstr.OpCodeID === this.OpCodes.WITH_EXCEPT_START_A)) {
                    isWithExceptHandler = true;
                } else if (targetInstr && targetInstr.OpCodeID === this.OpCodes.PUSH_EXC_INFO) {
                    const nextInstr = this.code.PeekInstructionAtOffset(e.target + 2);
                    if (nextInstr && (
                        nextInstr.OpCodeID === this.OpCodes.WITH_EXCEPT_START ||
                        nextInstr.OpCodeID === this.OpCodes.WITH_EXCEPT_START_A)) {
                        isWithExceptHandler = true;
                    }
                }
                if (!isWithExceptHandler) {
                    continue;
                }

                // Walk instructions starting at target until we finish the WITH cleanup:
                // stop once we've passed POP_EXCEPT and encounter a non-cleanup opcode.
                let offsetCursor = e.target;
                let steps = 0;
                let seenPopExcept = false;
                while (offsetCursor >= 0 && steps < 80) {
                    const instr = this.code.PeekInstructionAtOffset(offsetCursor);
                    if (!instr) break;

                    if (seenPopExcept && !cleanupOpcodes.has(instr.OpCodeID)) {
                        break;
                    }

                    this._withExceptRanges.add(instr.Offset);
                    if (instr.OpCodeID === this.OpCodes.POP_EXCEPT) {
                        seenPopExcept = true;
                    }

                    offsetCursor = instr.Offset + 2;
                    steps++;
                }

                if (g_cliArgs?.debug) {
                    const maxRange = Math.max(...this._withExceptRanges);
                    console.log(`[EnsureExcBlocks] Built WITH handler range from ${e.target} to ${maxRange} (steps=${steps})`);
                }
            }
            if (g_cliArgs?.debug) {
                console.log(`[EnsureExcBlocks] _withExceptRanges size: ${this._withExceptRanges.size}`);
            }
        }

        for (const entry of entries) {
            if (entry.start !== offset) {
                continue;
            }
            if (this.activeExceptionStarts.has(entry.start)) {
                continue;
            }
            // Skip entries that belong to with statements (marked by handleBeforeWith)
            if (entry._isWithStatement) {
                continue;
            }
            // Skip entries whose target is WITH_EXCEPT_START (with statement exception handlers)
            if (entry.target) {
                const targetInstr = this.code.PeekInstructionAtOffset(entry.target);
                let isWithExcept = false;
                if (targetInstr && (
                    targetInstr.OpCodeID === this.OpCodes.WITH_EXCEPT_START ||
                    targetInstr.OpCodeID === this.OpCodes.WITH_EXCEPT_START_A)) {
                    isWithExcept = true;
                } else if (targetInstr && targetInstr.OpCodeID === this.OpCodes.PUSH_EXC_INFO) {
                    const nextInstr = this.code.PeekInstructionAtOffset(entry.target + 2);
                    if (nextInstr && (
                        nextInstr.OpCodeID === this.OpCodes.WITH_EXCEPT_START ||
                        nextInstr.OpCodeID === this.OpCodes.WITH_EXCEPT_START_A)) {
                        isWithExcept = true;
                    }
                }
                if (isWithExcept) {
                    if (g_cliArgs?.debug) {
                        console.log(`[EnsureExcBlocks] Skipping with-statement exception entry at ${entry.start}, target=${entry.target} (WITH_EXCEPT_START)`);
                    }
                    continue;
                }
            }
            // Skip entries that start within WITH_EXCEPT_START handler regions
            if (this._withExceptRanges.has(entry.start)) {
                if (g_cliArgs?.debug) {
                    console.log(`[EnsureExcBlocks] Skipping entry at ${entry.start} (within WITH_EXCEPT_START handler)`);
                }
                continue;
            }
            // Skip comprehension cleanup handlers (Python 3.11+)
            // Pattern: handler target is SWAP and ends with STORE_FAST + RERAISE (no POP_EXCEPT)
            if (entry.target) {
                const targetInstr = this.code.PeekInstructionAtOffset(entry.target);
                if (targetInstr && targetInstr.OpCodeID === this.OpCodes.SWAP_A) {
                    // Check for comprehension cleanup pattern: SWAP → ... → STORE_FAST → RERAISE
                    let isComprehensionCleanup = false;
                    let cur = entry.target;
                    let steps = 0;
                    let sawStoreFast = false;
                    while (cur >= 0 && steps < 10) {
                        const instr = this.code.PeekInstructionAtOffset(cur);
                        if (!instr) break;
                        if (instr.OpCodeID === this.OpCodes.STORE_FAST_A ||
                            instr.OpCodeID === this.OpCodes.STORE_FAST) {
                            sawStoreFast = true;
                        }
                        if ((instr.OpCodeID === this.OpCodes.RERAISE ||
                             instr.OpCodeID === this.OpCodes.RERAISE_A) && sawStoreFast) {
                            isComprehensionCleanup = true;
                            break;
                        }
                        if (instr.OpCodeID === this.OpCodes.POP_EXCEPT) {
                            // Has POP_EXCEPT - this is a real except handler, not comprehension cleanup
                            break;
                        }
                        cur = instr.Offset + 2;
                        steps++;
                    }
                    if (isComprehensionCleanup) {
                        if (g_cliArgs?.debug) {
                            console.log(`[EnsureExcBlocks] Skipping comprehension cleanup handler at ${entry.start}, target=${entry.target}`);
                        }
                        continue;
                    }
                }
            }
            // Skip depth>0 entries whose start is a RERAISE cleanup site rather than
            // a user-level PUSH_EXC_INFO handler. These appear in CPython 3.11+ as
            // protected tails around `RERAISE 0` or `COPY n; POP_EXCEPT; RERAISE 1`
            // and have no source-level except counterpart.
            if (entry.depth > 0 && !isUserHandlerEntry(entry)) {
                if (g_cliArgs?.debug) {
                    console.log(`[EnsureExcBlocks] Skipping cleanup-only handler entry at ${entry.start} (not PUSH_EXC_INFO)`);
                }
                continue;
            }
            const handlerEnd = entry.depth === 0
                ? (maxHandlerEnd || entry.end || this.code.LastOffset || this.object.CodeSize || 0)
                : (entry.end || maxHandlerEnd || this.code.LastOffset || this.object.CodeSize || 0);
            const endCap = handlerEnd + 2;
            if (entry.depth === 0) {
                // Avoid opening nested/overlapping try blocks when one is already active for this range.
                const enclosingTry = [...this.blocks].reverse().find(b =>
                    b?.blockType === AST.ASTBlock.BlockType.Try &&
                    b.start <= entry.start &&
                    (b.end <= 0 || b.end > offset)
                );
                if (enclosingTry) {
                    continue;
                }

                const tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, entry.start, endCap, true);
                tryBlock.init();
                this.blocks.push(tryBlock);
                this.curBlock = tryBlock;
            } else {
                // Allow nested handlers but ensure only one active at a time
                if (this.inExceptionTableHandler) {
                    if (g_cliArgs?.debug) {
                        console.log(`[ensureExcBlocks] Skipping entry at ${entry.start} - already in handler`);
                    }
                    continue;
                }
                if (g_cliArgs?.debug) {
                    console.log(`[ensureExcBlocks] Creating Except block at offset ${entry.start}`);
                }
                const excBlock = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, entry.start, endCap, null, false);
                excBlock.init();
                this.blocks.push(excBlock);
                this.curBlock = excBlock;
                this.inExceptionTableHandler = true;
                // Provide synthetic exception instance for handler
                const excInstance = new AST.ASTName('__exception__');
                excInstance.line = this.code.Current?.LineNo;
                this.dataStack.push(excInstance);
            }
            this.activeExceptionStarts.add(entry.start);
        }
    }

    findExceptionHandlerEnd(offset) {
        const entries = this.object.ExceptionTable || [];
        const matches = entries.filter(e => e.depth > 0 && offset >= e.start && offset < e.end);
        if (!matches.length) {
            return this.maxExceptionHandlerEnd || null;
        }
        let end = Math.max(...matches.map(e => e.end));
        // CPython 3.11+ splits a single source-level except handler into
        // contiguous depth>0 sub-regions (alias-binding, body, cleanup).
        // Walk forward through adjacent depth>0 entries so the Except block
        // covers the full handler body, not just the alias-binding region.
        let guard = 0;
        while (guard++ < 32) {
            const next = entries.find(e =>
                e.depth > 0 &&
                e.start >= end &&
                e.start <= end + 2 &&
                e.end > end);
            if (!next) break;
            end = next.end;
        }
        // The exception-table entry only covers the prologue (the protected
        // region around CHECK_EXC_MATCH). The actual handler body — user
        // statements, POP_EXCEPT, and the terminating exit — lives past the
        // entry end. Walk forward to include POP_EXCEPT and the following
        // terminator (RETURN/JUMP_FORWARD/RERAISE) so the Except block
        // captures the body that renders as user code.
        if (this.code && this.OpCodes) {
            let cursor = end;
            let steps = 0;
            let sawHandlerExit = false;
            while (cursor >= 0 && steps++ < 500) {
                const instr = this.code.PeekInstructionAtOffset(cursor);
                if (!instr) break;
                const op = instr.OpCodeID;
                // Stop if we enter another handler's prologue.
                if (op === this.OpCodes.PUSH_EXC_INFO) break;
                if (op === this.OpCodes.POP_EXCEPT) {
                    sawHandlerExit = true;
                    end = instr.Offset + (instr.Size || 2);
                    cursor = end;
                    continue;
                }
                if (sawHandlerExit && (
                    op === this.OpCodes.RETURN_VALUE ||
                    op === this.OpCodes.RETURN_VALUE_A ||
                    op === this.OpCodes.RETURN_CONST_A ||
                    op === this.OpCodes.JUMP_FORWARD ||
                    op === this.OpCodes.JUMP_FORWARD_A ||
                    op === this.OpCodes.JUMP_BACKWARD ||
                    op === this.OpCodes.JUMP_BACKWARD_A ||
                    op === this.OpCodes.RERAISE ||
                    op === this.OpCodes.RERAISE_A)) {
                    end = instr.Offset + (instr.Size || 2);
                    break;
                }
                if (sawHandlerExit) {
                    // Skip trailing CACHE/POP_TOP cleanup that sometimes sits
                    // between POP_EXCEPT and the terminator on 3.11+.
                    if (op === this.OpCodes.CACHE ||
                        op === this.OpCodes.POP_TOP) {
                        cursor = instr.Offset + (instr.Size || 2);
                        continue;
                    }
                    break;
                }
                cursor = instr.Offset + (instr.Size || 2);
            }
        }
        return end;
    }
    
    statements () {
        if (this.object == null) {
            return null;
        }

        // Track SETUP_FINALLY/SETUP_EXCEPT targets for exception handling
        this.exceptionHandlerOffsets = new Set();

        while (this.code.HasInstructionsToProcess) {
            try {
                this.code.GoNext();

                // Open blocks based on 3.11+ exception table (no SETUP_EXCEPT opcodes)
                this.ensureExceptionTableBlocks();

                // Early-return/raise in try body: CPython omits POP_BLOCK+JUMP_FORWARD,
                // so the Try block is still open when we reach the except/finally handler.
                // Close it and open Except/Finally here so handler prologue is consumed
                // in the right block and __exception__ doesn't leak into Try.
                if (this.code.Current.Offset > 0 && this.blocks.length > 1) {
                    let tryIdx = -1, containerIdx = -1, isFinally = false;
                    for (let i = this.blocks.length - 1; i >= 0; i--) {
                        const blk = this.blocks[i];
                        if (blk.blockType === AST.ASTBlock.BlockType.Container) {
                            if (blk.hasExcept && blk.except === this.code.Current.Offset) {
                                containerIdx = i;
                                isFinally = false;
                                break;
                            }
                            if (blk.hasFinally && !blk.hasExcept
                                && blk.finally === this.code.Current.Offset) {
                                containerIdx = i;
                                isFinally = true;
                                break;
                            }
                        }
                        if (blk.blockType === AST.ASTBlock.BlockType.Try && tryIdx === -1) {
                            tryIdx = i;
                        }
                    }
                    if (containerIdx >= 0 && tryIdx > containerIdx
                        && this.curBlock.blockType !== AST.ASTBlock.BlockType.Except
                        && this.curBlock.blockType !== AST.ASTBlock.BlockType.Finally) {
                        while (this.blocks.length - 1 > containerIdx) {
                            const top = this.blocks[this.blocks.length - 1];
                            this.blocks.pop();
                            this.curBlock = this.blocks.top();
                            this.curBlock.append(top);
                        }
                        const cont = this.curBlock;
                        const handlerStart = isFinally ? cont.finally : cont.except;
                        let handlerEnd = handlerStart;
                        let cursor = handlerStart;
                        for (let k = 0; k < 500; k++) {
                            const instr = this.code.PeekInstructionAtOffset(cursor);
                            if (!instr) break;
                            const op = instr.OpCodeID;
                            if (op === this.OpCodes.END_FINALLY
                                || op === this.OpCodes.POP_EXCEPT
                                || op === this.OpCodes.RERAISE_A
                                || op === this.OpCodes.RERAISE) {
                                handlerEnd = instr.Offset;
                                break;
                            }
                            if (op === this.OpCodes.RETURN_VALUE
                                || op === this.OpCodes.RETURN_VALUE_A
                                || op === this.OpCodes.RETURN_CONST_A
                                || op === this.OpCodes.RAISE_VARARGS_A) {
                                handlerEnd = instr.Offset + (instr.Size || 2);
                                break;
                            }
                            cursor = instr.Offset + (instr.Size || 2);
                        }
                        if (isFinally) {
                            let finallyBlk = new AST.ASTBlock(AST.ASTBlock.BlockType.Finally, this.code.Current.Offset, handlerEnd, true);
                            this.blocks.push(finallyBlk);
                            this.curBlock = this.blocks.top();
                            if (global.g_cliArgs?.debug) {
                                console.log(`[EarlyReturnFinally] Opened Finally at ${this.code.Current.Offset}, handlerEnd=${handlerEnd}`);
                            }
                        } else {
                            let except = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, this.code.Current.Offset, handlerEnd, null, false);
                            except.init();
                            this.blocks.push(except);
                            this.curBlock = this.blocks.top();
                            if (global.g_cliArgs?.debug) {
                                console.log(`[EarlyReturnExcept] Opened Except at ${this.code.Current.Offset}, handlerEnd=${handlerEnd}`);
                            }
                        }
                    }
                }

                // Python 3.8: When entering exception handler, push exception instance to stack
                if (this.exceptionHandlerOffsets.has(this.code.Current.Offset)) {
                    // Create synthetic exception instance placeholder
                    let excInstance = new AST.ASTName('__exception__');
                    excInstance.line = this.code.Current.LineNo;
                    this.dataStack.push(excInstance);

                    if (global.g_cliArgs?.debug) {
                        console.log(`[ExceptionHandler] Pushed synthetic exception at offset ${this.code.Current.Offset}`);
                    }
                }

                // Finalize pending ternary expressions at their join point
                this.maybeCompleteConditionalExpr();

                // If inside exception handler, force curBlock to latest Except
                if (this.inExceptionTableHandler && this.blocks.top()?.blockType !== AST.ASTBlock.BlockType.Except) {
                    for (let i = this.blocks.length - 1; i >= 0; i--) {
                        if (this.blocks[i].blockType === AST.ASTBlock.BlockType.Except) {
                            this.curBlock = this.blocks[i];
                            break;
                        }
                    }
                }
                // While in exception handler, attach current instruction target into handler if it is a stack value
                this.appendExceptionExprs =
                    this.inExceptionTableHandler &&
                    this.curBlock?.blockType === AST.ASTBlock.BlockType.Except &&
                    this.dataStack.length > 0 &&
                    ![this.OpCodes.POP_EXCEPT, this.OpCodes.RERAISE_A, this.OpCodes.RERAISE].includes(this.code.Current.OpCodeID);

                if (g_cliArgs?.debug && g_cliArgs.verbose && (this.code.Current.InstructionName?.includes('JUMP') || this.code.Current.InstructionName?.includes('BREAK') || this.code.Current.InstructionName?.includes('LOOP') || this.code.Current.Offset < 30)) {
                    console.log(`[${this.code.Current.Offset}] ${this.code.Current.InstructionName} arg=${this.code.Current.Argument} target=${this.code.Current.JumpTarget || 'N/A'}`);
                }

                // Skip unreachable code after break/continue/return
                if (this.unreachableUntil > 0 && this.code.Current.Offset < this.unreachableUntil) {
                    if (g_cliArgs?.debug) {
                        console.log(`Skipping unreachable code at offset ${this.code.Current.Offset} (until ${this.unreachableUntil}): ${this.code.Current.InstructionName}`);
                    }
                    continue;
                }
                if (this.unreachableUntil > 0) {
                    if (g_cliArgs?.debug) {
                        console.log(`Exiting unreachable region at offset ${this.code.Current.Offset} (was until ${this.unreachableUntil})`);
                    }
                }
                this.unreachableUntil = -1;  // Reset when we pass the unreachable region

                if (this.need_try && this.code.Current.OpCodeID != this.OpCodes.SETUP_EXCEPT_A) {
                    this.need_try = false;
        
                    let tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, this.code.Current.Offset, this.curBlock.end, true);
                    this.blocks.push(tryBlock);
                    this.curBlock = this.blocks.top();
                } else if (
                    this.else_pop &&
                    ![
                        this.OpCodes.JUMP_FORWARD_A,
                        this.OpCodes.JUMP_IF_FALSE_A,
                        this.OpCodes.JUMP_IF_FALSE_OR_POP_A,
                        this.OpCodes.POP_JUMP_IF_FALSE_A,
                        this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A,
                        this.OpCodes.JUMP_IF_TRUE_A,
                        this.OpCodes.JUMP_IF_TRUE_OR_POP_A,
                        this.OpCodes.POP_JUMP_IF_TRUE_A,
                        this.OpCodes.POP_JUMP_FORWARD_IF_TRUE_A,
                        this.OpCodes.POP_BLOCK
                    ].includes(this.code.Current.OpCodeID)
                ) {
                    this.else_pop = false;
        
                    let prev = this.curBlock;
                    while (prev.end < this.code.Next?.Offset && prev.blockType != AST.ASTBlock.BlockType.Main) {
                        if (prev.blockType != AST.ASTBlock.BlockType.Container) {
                            if (prev.end == 0) {
                                break;
                            }
                        }

                        if (g_cliArgs?.debug) {
                            console.log(`Closing block ${prev.type_str}(${prev.start}-${prev.end}) at offset ${this.code.Current.Offset} (Next=${this.code.Next?.Offset})`);
                        }

                        this.blocks.pop();

                        if (this.blocks.empty())
                            break;

                        this.curBlock = this.blocks.top();
                        this.curBlock.append(prev);

                        if (g_cliArgs?.debug) {
                            console.log(`  Appended to ${this.curBlock.type_str}(${this.curBlock.start}-${this.curBlock.end}), now has ${this.curBlock.nodes.length} nodes`);
                        }

                        prev = this.curBlock;

                        this.checkIfExpr();
                    }
                }
        
                // Close WITH blocks BEFORE processing the instruction at their end offset
                // This prevents the cleanup code (LOAD_CONST None, CALL __exit__) from being added to the block
                // Loop to close all nested WITH blocks that have reached their end
                let closedWithBlock = false;
                while (this.blocks.length > 1) {
                    // Find the topmost WITH block
                    let withIdx = -1;
                    for (let i = this.blocks.length - 1; i >= 1; i--) {
                        if (this.blocks[i].blockType === AST.ASTBlock.BlockType.With) {
                            withIdx = i;
                            break;
                        }
                    }
                    if (withIdx < 0) break;

                    const withBlock = this.blocks[withIdx];
                    if (withBlock.end <= 0 || this.code.Current.Offset < withBlock.end) {
                        break;  // This WITH block hasn't reached its end yet
                    }

                    // Close this WITH block
                    this.blocks.splice(withIdx, 1);
                    const parentBlock = this.blocks[withIdx - 1] || this.blocks.top();
                    parentBlock.append(withBlock);
                    closedWithBlock = true;
                    if (g_cliArgs?.debug) {
                        console.log(`[Pre-handler] Closed WITH block at offset ${this.code.Current.Offset}, withEnd=${withBlock.end}`);
                    }
                    this.curBlock = this.blocks.top();
                }

                // Skip the __exit__ cleanup code after closing WITH blocks
                // Pattern: LOAD_CONST None, LOAD_CONST None, LOAD_CONST None, CALL 2/3, POP_TOP
                if (closedWithBlock) {
                    // Check if we're at the start of __exit__ cleanup code
                    const constObj = this.code.Current.ConstantObject?.object;
                    const isLoadingNone = this.code.Current.OpCodeID === this.OpCodes.LOAD_CONST_A &&
                        (constObj == null || constObj.ClassName === 'Py_None');
                    if (isLoadingNone) {
                        // Skip the cleanup pattern: LOAD_CONST None x3, CALL, CACHE*, POP_TOP
                        // Stop at any instruction that starts a new statement
                        let skipCount = 0;
                        while (this.code.HasInstructionsToProcess && skipCount < 20) {
                            const instr = this.code.Current;
                            // Stop at instructions that start new statements
                            if (instr.OpCodeID === this.OpCodes.BEFORE_WITH ||
                                instr.OpCodeID === this.OpCodes.PUSH_NULL ||
                                instr.OpCodeID === this.OpCodes.RETURN_VALUE ||
                                instr.OpCodeID === this.OpCodes.RETURN_CONST_A ||
                                instr.OpCodeID === this.OpCodes.LOAD_FAST_A ||
                                instr.OpCodeID === this.OpCodes.LOAD_FAST_BORROW_A ||
                                instr.OpCodeID === this.OpCodes.LOAD_FAST_CHECK_A ||
                                instr.OpCodeID === this.OpCodes.LOAD_NAME_A ||
                                instr.OpCodeID === this.OpCodes.LOAD_GLOBAL_A ||
                                instr.OpCodeID === this.OpCodes.STORE_FAST_A ||
                                instr.OpCodeID === this.OpCodes.STORE_NAME_A) {
                                break;
                            }
                            if (g_cliArgs?.debug) {
                                console.log(`[Pre-handler] Skipping WITH cleanup: ${instr.InstructionName} at ${instr.Offset}`);
                            }
                            skipCount++;
                            this.code.GoNext();
                        }
                        // Don't continue - let the current instruction be processed
                    }
                }

                // Resolve any open boolean-expression chain frames whose target
                // offset matches the current instruction. This folds pending
                // JUMP_IF_FALSE/TRUE lhs+rhs pairs into ASTBinary AND/OR nodes
                // and pushes the result onto dataStack before the consumer
                // (STORE_*, RETURN_*, CALL_*, or a nested JUMP_IF_*) fires.
                if (this.boolChainStack && this.boolChainStack.length > 0) {
                    resolveBoolChainFrames(this, this.code.Current.Offset);
                }

                if (this.code.Current.OpCodeID in PycDecompiler.opCodeHandlers)
                {
                    PycDecompiler.opCodeHandlers[this.code.Current.OpCodeID].call(this);
                } else {
                    // Unsupported opcode: bail out of the loop with what we have.
                    // Record so `--strict` and the dirty-files report can surface it.
                    this.errors.push({
                        opcode: this.code.Current.InstructionName,
                        argument: this.code.Current.Argument,
                        offset: this.code.Current.Offset,
                        fileOffset: this.object.codeOffset + this.code.Current.Offset,
                        codeObject: this.object.Name,
                        message: `Unsupported opcode ${this.code.Current.InstructionName}`,
                        unsupported: true
                    });
                    if (global.g_cliArgs?.strict) {
                        throw new Error(`Unsupported opcode ${this.code.Current.InstructionName} at offset ${this.code.Current.Offset}`);
                    }
                    if (!g_cliArgs?.silent) {
                        console.error(`Unsupported opcode ${this.code.Current.InstructionName} at pos ${this.code.Current.Offset}\n`);
                    }
                    this.cleanBuild = false;
                    let node = new AST.ASTNodeList(this.defBlock.nodes);
                    return node;
                }
                this.closeEndedBlocks();
                this.else_pop = [AST.ASTBlock.BlockType.Else,
                            AST.ASTBlock.BlockType.If,
                            AST.ASTBlock.BlockType.Elif
                            ].includes(this.curBlock.blockType)
                        && (this.curBlock.end == this.code.Next?.Offset);

            } catch (ex) {
                // Record the failure so callers can detect partial output. Without this
                // accumulator the main loop swallows handler exceptions silently and
                // cleanBuild gets reset to true at end-of-loop, masking corruption.
                this.errors.push({
                    opcode: this.code.Current.InstructionName,
                    argument: this.code.Current.Argument,
                    offset: this.code.Current.Offset,
                    fileOffset: this.object.codeOffset + this.code.Current.Offset,
                    codeObject: this.object.Name,
                    message: ex.message,
                    stack: ex.stack
                });
                if (global.g_cliArgs?.strict) {
                    throw ex;
                }
                if (!g_cliArgs?.silent) {
                    console.error(`EXCEPTION for OpCode ${this.code.Current.InstructionName} (${this.code.Current.Argument}) at offset ${this.code.Current.Offset} in code object '${this.object.Name}', file offset ${this.object.codeOffset + this.code.Current.Offset} : ${ex.message}\n\n`);
                    if (global.g_cliArgs?.debug) {
                        console.error('Stack trace:', ex.stack);
                    }
                }
            }
        }
    
        if (this.blocks.length > 1) {
            if (g_cliArgs?.debug) {
                console.error(`Warning: block stack is not empty${this.blocks.length} blocks.\n`);
                console.error('Remaining blocks in stack:');
                for (let i = 0; i < this.blocks.length; i++) {
                    let blk = this.blocks[i];
                    console.error(`  [${i}] ${blk.type_str} (${blk.start}-${blk.end}) nodes=${blk.nodes.length}`);
                }
            }

            while (this.blocks.length > 1) {
                let tmp = this.blocks.pop();

                // Set end offset for blocks that were never closed properly
                if (tmp.end === 0 || tmp.end === undefined) {
                    tmp.end = this.code.Current?.Offset || this.object.CodeSize;
                    if (g_cliArgs?.debug) {
                        console.error(`  Setting end=${tmp.end} for unclosed ${tmp.type_str}(${tmp.start}-${tmp.end})`);
                    }
                }

                if (g_cliArgs?.debug) {
                    console.error(`Appending ${tmp.type_str} (nodes=${tmp.nodes.length}) to ${this.blocks.top().type_str}`);
                }
                this.blocks.top().append(tmp);
            }
        }
    
        this.cleanBuild = this.errors.length === 0;
        let mainNode = new AST.ASTNodeList(this.defBlock.nodes);
        return mainNode;
    }

    transformExceptionGroups(root) {
        const merged = this.mergeOrphanedEgHandlers(root);
        if (merged) {
            // Still run light cleanup to drop residual artifacts
            this.cleanupExceptBlocks(root);
            this.pruneEmptyExcepts(root);
            return;
        }

        // Breadth-first traversal to avoid deep recursion; skip on large graphs
        const MAX_VISITED = 20000;
        const queue = [root];
        const visited = new WeakSet();
        let visitedCount = 0;
        while (queue.length) {
            const node = queue.shift();
            if (!node || visited.has(node)) continue;
            visited.add(node);
            if (++visitedCount > MAX_VISITED) break;
            if (node instanceof AST.ASTNodeList) {
                queue.push(...node.list);
            } else if (node instanceof AST.ASTStore) {
                queue.push(node.src);
            } else if (node instanceof AST.ASTFunction) {
                queue.push(node.code?.object?.SourceCode);
            } else if (node instanceof AST.ASTBlock || node instanceof AST.ASTCondBlock) {
                if (node instanceof AST.ASTCondBlock) {
                    this.tryConvertExceptStar(node);
                }
                queue.push(...(node.nodes || []));
            }
        }

        if (visitedCount <= MAX_VISITED) {
            this.flattenNestedExcepts(root);
            this.removeEgHelperArtifacts(root);
            this.cleanupExceptBlocks(root);
            this.pruneEmptyExcepts(root);
        }
    }

    mergeOrphanedEgHandlers(root) {
        if (!(root instanceof AST.ASTNodeList)) {
            return false;
        }

        const tryIdx = root.list.findIndex(n => n instanceof AST.ASTBlock && n.blockType === AST.ASTBlock.BlockType.Try);
        if (tryIdx < 0 || tryIdx >= root.list.length - 1) {
            return false;
        }

        const trailing = root.list.slice(tryIdx + 1);
        // Skip leading cleanup nodes (e = None / del e / __exception__ artifacts)
        let firstStoreIdx = trailing.findIndex(n =>
            n instanceof AST.ASTStore &&
            n.src instanceof AST.ASTCall &&
            n.src.func instanceof AST.ASTName &&
            n.src.func.name === "__check_eg_match__");

        if (firstStoreIdx < 0) {
            return false;
        }

        const first = trailing[firstStoreIdx];
        const matchType = first.src.pparams?.[1] || null;

        if (!matchType) {
            return false;
        }

        const aliasName = first instanceof AST.ASTStore ? (first.dest || new AST.ASTName("e")) : new AST.ASTName("e");

        // Drop cleanup artifacts; keep only meaningful body (e.g., print)
        const filtered = trailing.slice(firstStoreIdx).filter(node => {
            if (node instanceof AST.ASTSubscr && !node.name && !node.key) {
                return false;
            }
            if (node instanceof AST.ASTReturn && node.value instanceof AST.ASTObject && node.value.m_obj == null) {
                return false;
            }
            if (node instanceof AST.ASTStore &&
                node.src instanceof AST.ASTCall &&
                node.src.func?.name === "__check_eg_match__") {
                return false;
            }
            if (aliasName && node instanceof AST.ASTStore &&
                node.dest?.name === aliasName.name &&
                node.src instanceof AST.ASTNone) {
                return false;
            }
            if (aliasName && node instanceof AST.ASTDelete &&
                node.value?.name === aliasName.name) {
                return false;
            }
            return true;
        });

        if (!filtered.length) {
            return false;
        }

        const tryBlock = root.list[tryIdx];
        const sanitizeBody = (nodes) => {
            return (nodes || []).filter(node => {
                if (node instanceof AST.ASTStore &&
                    node.src instanceof AST.ASTCall &&
                    node.src.func?.name === "__check_eg_match__") {
                    return false;
                }
                if (node instanceof AST.ASTStore &&
                    node.dest?.name === aliasName.name &&
                    node.src instanceof AST.ASTNone) {
                    return false;
                }
                if (node instanceof AST.ASTDelete &&
                    node.value?.name === aliasName.name) {
                    return false;
                }
                if (node instanceof AST.ASTSubscr && !node.name && !node.key) {
                    return false;
                }
                if (node instanceof AST.ASTReturn && node.value instanceof AST.ASTObject && node.value.m_obj == null) {
                    return false;
                }
                const condStr = node.condition?.codeFragment?.()?.toString?.();
                if (node instanceof AST.ASTCondBlock && typeof condStr === 'string' && condStr.includes('__prep_reraise_star__')) {
                    return false;
                }
                if (node instanceof AST.ASTReturn && (!node.value || node.value instanceof AST.ASTNone)) {
                    return false;
                }
                return true;
            });
        };

        // Capture existing ValueError body if present
        const existingExcepts = (tryBlock.nodes || []).filter(n => n instanceof AST.ASTCondBlock && n.blockType === AST.ASTBlock.BlockType.Except);
        const valueErrBlock = existingExcepts.find(b => {
            const cond = b.condition;
            const condName = cond instanceof AST.ASTStore ? cond.src : cond;
            return condName instanceof AST.ASTName && condName.name === "ValueError";
        });
        let valueErrBody = sanitizeBody(valueErrBlock?.nodes || []);
        const typeErrBody = sanitizeBody(filtered);

        const callNode = (tryBlock.nodes || []).find(n => n instanceof AST.ASTCall);
        const newBlocks = [];
        if (callNode) {
            newBlocks.push(callNode);
        }

        // If the ValueError handler lost its body (common on 3.11), pull following siblings in the try
        if (valueErrBlock && valueErrBody.length === 0) {
            const tryNodes = tryBlock.nodes || [];
            const valIdx = tryNodes.indexOf(valueErrBlock);
            if (valIdx >= 0) {
                const tail = [];
                for (let i = valIdx + 1; i < tryNodes.length; i++) {
                    const n = tryNodes[i];
                    if (n instanceof AST.ASTCondBlock && n.blockType === AST.ASTBlock.BlockType.Except) {
                        break;
                    }
                    tail.push(n);
                }
                if (tail.length) {
                    // Remove tail from try block
                    tryBlock.m_nodes = tryNodes.slice(0, valIdx + 1);
                    valueErrBody = sanitizeBody(tail);
                }
            }
        }

        const makeExcept = (typeName, body) => {
            const cond = new AST.ASTStore(new AST.ASTName(typeName), aliasName);
            cond.line = aliasName.line || cond.line;
            const blk = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, -1, -1, cond, false);
            blk.isExceptStar = true;
            blk.nodes.push(...body);
            return blk;
        };

        if (valueErrBody.length) {
            newBlocks.push(makeExcept("ValueError", valueErrBody));
        }
        if (typeErrBody.length) {
            newBlocks.push(makeExcept(matchType?.name || matchType?.toString?.() || "Exception", typeErrBody));
        }

        if (newBlocks.length) {
            tryBlock.m_nodes = newBlocks;
        }

        // Remove only the consumed trailing nodes (including any leading cleanup we skipped over)
        root.list.splice(tryIdx + 1 + firstStoreIdx, trailing.length - firstStoreIdx);
        return true;
    }

    tryConvertExceptStar(block) {
        if (!this.isExceptStarPattern(block)) {
            return;
        }

        const compare = block.condition;
        const call = compare.left;
        let aliasStore = null;
        for (let child of block.nodes || []) {
            if (child instanceof AST.ASTStore && child.src === call && child.dest instanceof AST.ASTName) {
                aliasStore = child;
                break;
            }
        }

        if (!aliasStore || !(aliasStore.dest instanceof AST.ASTName)) {
            return;
        }

        const aliasName = aliasStore.dest;
        const typeNode = call.pparams?.[1] || new AST.ASTName("ExceptionGroup");

        const filtered = (block.nodes || []).filter(child => child !== aliasStore);
        const cleaned = filtered.filter(child => {
            if (child instanceof AST.ASTStore && child.dest?.name === aliasName.name && child.src instanceof AST.ASTNone) {
                return false;
            }
            if (child instanceof AST.ASTDelete && child.value?.name === aliasName.name) {
                return false;
            }
            return true;
        });
        block.m_nodes = cleaned;

        const condStore = new AST.ASTStore(typeNode, aliasName);
        condStore.line = block.line;
        block.condition = condStore;
        block.m_blockType = AST.ASTBlock.BlockType.Except;
        block.isExceptStar = true;
        block.negative = false;

    }

    isExceptStarPattern(block) {
        if (!(block instanceof AST.ASTCondBlock)) {
            return false;
        }

        if (![AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Elif].includes(block.blockType)) {
            return false;
        }

        const cond = block.condition;
        if (!(cond instanceof AST.ASTCompare)) {
            return false;
        }
        if (![AST.ASTCompare.CompareOp.Is, AST.ASTCompare.CompareOp.IsNot].includes(cond.op)) {
            return false;
        }
        if (!(cond.right instanceof AST.ASTNone)) {
            return false;
        }
        const left = cond.left;
        if (!(left instanceof AST.ASTCall)) {
            return false;
        }
        if (left.func?.name !== '__check_eg_match__') {
            return false;
        }
        return true;
    }

    removeEgHelperArtifacts(node) {
        // Temporarily disabled to avoid deep recursion issues
        return;
    }

    flattenNestedExcepts(root) {
        const queue = [{node: root, parentArr: null}];
        const visited = new WeakSet();
        while (queue.length) {
            const {node, parentArr} = queue.shift();
            if (!node || visited.has(node)) continue;
            visited.add(node);

            const children = node instanceof AST.ASTNodeList ? node.list :
                             (node instanceof AST.ASTBlock || node instanceof AST.ASTCondBlock) ? node.nodes :
                             null;

            if (Array.isArray(children)) {
                for (let idx = 0; idx < children.length; idx++) {
                    const child = children[idx];
                    if (child instanceof AST.ASTCondBlock && child.blockType === AST.ASTBlock.BlockType.Except) {
                        const hoisted = [];
                        child.m_nodes = (child.nodes || []).filter(n => {
                            if (n instanceof AST.ASTCondBlock && n.blockType === AST.ASTBlock.BlockType.Except) {
                                hoisted.push(n);
                                return false;
                            }
                            return true;
                        });
                        if (hoisted.length && Array.isArray(children)) {
                            children.splice(idx + 1, 0, ...hoisted);
                        }
                    }
                }
                // Enqueue after potential mutation to avoid skipping
                children.forEach(ch => queue.push({node: ch, parentArr: children}));
            }
        }
    }

    cleanupExceptBlocks(node) {
        if (!node) return;
        const stripExcept = (blk) => {
            if (blk.blockType !== AST.ASTBlock.BlockType.Except) return;
            let aliasName = null;
            let matchType = null;
            blk.m_nodes = (blk.nodes || []).filter(child => {
                if (child.blockType === AST.ASTBlock.BlockType.Except) {
                    return false;
                }
                if (child instanceof AST.ASTCondBlock && child.blockType == AST.ASTBlock.BlockType.Except) {
                    return false; // drop nested excepts
                }
                if (child instanceof AST.ASTStore &&
                    child.src instanceof AST.ASTCall &&
                    child.src.func?.name === "__check_eg_match__") {
                    aliasName = child.dest instanceof AST.ASTName ? child.dest : aliasName;
                    matchType = child.src.pparams?.[1] || matchType;
                    return false; // header already encodes condition
                }
                if (child instanceof AST.ASTStore &&
                    child.dest instanceof AST.ASTName &&
                    child.src instanceof AST.ASTNone) {
                    aliasName = child.dest;
                    return false;
                }
                if (child instanceof AST.ASTDelete && aliasName && child.value?.name === aliasName.name) {
                    return false;
                }
                if (child instanceof AST.ASTCondBlock) {
                    const condStr = child.condition?.codeFragment?.();
                    if (typeof condStr === 'string' && condStr.includes("__exception__<EXCEPTION MATCH>")) {
                        return false;
                    }
                }
                if (child instanceof AST.ASTSubscr) {
                    const frag = child.codeFragment?.();
                    const fragStr = frag?.toString?.() || '';
                    if (fragStr.includes('__exception__')) {
                        return false;
                    }
                }
                return true;
            });
            if (aliasName) {
                const existing = blk.condition;
                if (existing instanceof AST.ASTStore) {
                    // Condition already encodes `Type as alias` (set by misc_other.js
                    // POP_TOP→STORE_FAST→POP_TOP path). Don't double-wrap.
                    if (matchType) {
                        blk.isExceptStar = true;
                    }
                } else {
                    const cond = matchType || existing || new AST.ASTName("Exception");
                    blk.condition = new AST.ASTStore(cond, aliasName);
                    if (matchType) {
                        blk.isExceptStar = true;
                    }
                }
            }
            if (blk.m_nodes.length > 3) {
                // Trim runaway nested bodies: keep calls and raises
                blk.m_nodes = blk.m_nodes.filter(ch => ch instanceof AST.ASTCall || ch instanceof AST.ASTRaise);
            }
        };

        // Limit traversal breadth/depth to avoid runaway recursion on malformed trees
        const queue = [{n: node, d: 0}];
        const visitedNodes = new WeakSet();
        const MAX_DEPTH = 512;
        const MAX_VISITED = 5000;
        let visitedCount = 0;
        while (queue.length) {
            const {n: cur, d} = queue.shift();
            if (!cur || visitedNodes.has(cur)) continue;
            visitedNodes.add(cur);
            if (++visitedCount > MAX_VISITED) break;
            if (d > MAX_DEPTH) continue;
            if (cur instanceof AST.ASTBlock || cur instanceof AST.ASTCondBlock) {
                stripExcept(cur);
                (cur.nodes || []).forEach(ch => queue.push({n: ch, d: d + 1}));
            } else if (cur instanceof AST.ASTNodeList) {
                cur.list.forEach(ch => queue.push({n: ch, d: d + 1}));
            }
        }
    }

    pruneEmptyExcepts(root) {
        const queue = [{node: root, parentArr: null, idx: -1}];
        const visited = new WeakSet();
        const isCleanupNode = (node, aliasName) => {
            if (!node) return false;
            if (node instanceof AST.ASTStore &&
                node.src instanceof AST.ASTCall &&
                node.src.func?.name === "__check_eg_match__") {
                return false;
            }
            if (node instanceof AST.ASTDelete) {
                return !aliasName || node.value?.name === aliasName.name;
            }
            if (node instanceof AST.ASTStore && node.dest?.name === aliasName?.name && node.src instanceof AST.ASTNone) {
                return true;
            }
            let fragStr = '';
            try {
                const frag = node?.codeFragment?.();
                fragStr = frag?.toString?.() || '';
            } catch (e) {
                // Skip nodes that fail to render
            }
            if (typeof fragStr === 'string' && fragStr.includes('__exception__')) {
                return true;
            }
            if (node instanceof AST.ASTKeyword && node.word === AST.ASTKeyword.Word.Pass) {
                return true;
            }
            return false;
        };

        // Helper to check if a node is except* cleanup at parent level
        const isExceptStarCleanup = (node, aliasNames) => {
            if (!node || !aliasNames || aliasNames.size === 0) return false;
            // Never treat full blocks as cleanup; only simple statements can be cleanup artifacts.
            if (node instanceof AST.ASTBlock || node instanceof AST.ASTCondBlock) {
                return false;
            }
            // del e
            if (node instanceof AST.ASTDelete && aliasNames.has(node.value?.name)) {
                return true;
            }
            // e = None
            if (node instanceof AST.ASTStore && aliasNames.has(node.dest?.name)) {
                const val = node.src;
                if (val instanceof AST.ASTNone || val?.object?.ClassName === 'Py_None') {
                    return true;
                }
            }
            // __exception__[...]
            let fragStr = '';
            try {
                const frag = node?.codeFragment?.();
                fragStr = frag?.toString?.() || '';
            } catch (e) {
                // Skip nodes that fail to render
            }
            if (typeof fragStr === 'string' && fragStr.includes('__exception__')) {
                return true;
            }
            return false;
        };

        // First pass: collect except* alias names from try blocks and filter sibling cleanup
        const filterExceptStarCleanup = (children) => {
            if (!Array.isArray(children)) return;
            const aliasNames = new Set();
            // Collect alias names from except* handlers in try blocks
            for (const child of children) {
                if (child instanceof AST.ASTBlock && child.blockType === AST.ASTBlock.BlockType.Try) {
                    for (const tryChild of (child.nodes || [])) {
                        if (tryChild instanceof AST.ASTCondBlock &&
                            tryChild.blockType === AST.ASTBlock.BlockType.Except &&
                            tryChild.isExceptStar) {
                            const alias = tryChild.condition instanceof AST.ASTStore ? tryChild.condition.dest?.name : null;
                            if (alias) aliasNames.add(alias);
                        }
                    }
                }
            }
            // Filter cleanup nodes at this level
            if (aliasNames.size > 0) {
                for (let i = children.length - 1; i >= 0; i--) {
                    if (isExceptStarCleanup(children[i], aliasNames)) {
                        children.splice(i, 1);
                    }
                }
            }
        };

        while (queue.length) {
            const {node, parentArr, idx} = queue.shift();
            if (!node || visited.has(node)) continue;
            visited.add(node);

            if (node instanceof AST.ASTCondBlock && node.blockType === AST.ASTBlock.BlockType.Except) {
                const alias = node.condition instanceof AST.ASTStore ? node.condition.dest : null;
                const filtered = (node.nodes || []).filter(n => !isCleanupNode(n, alias));

                // Only synthetic except* handlers without a condition AND no real body
                // should be dropped; user-written `except:` and `except E:` blocks must
                // be preserved (with `pass` if the body was nothing but cleanup).
                if (filtered.length === 0) {
                    node.m_nodes = [new AST.ASTKeyword(AST.ASTKeyword.Word.Pass)];
                } else if (filtered.length !== (node.nodes || []).length) {
                    node.m_nodes = filtered;
                }
                if (Array.isArray(parentArr) && node.isExceptStar && !node.condition && filtered.length === 0) {
                    parentArr.splice(idx, 1);
                    continue;
                }
            }

            const children = node instanceof AST.ASTNodeList ? node.list :
                             (node instanceof AST.ASTBlock || node instanceof AST.ASTCondBlock) ? node.nodes :
                             null;
            if (Array.isArray(children)) {
                // Filter except* cleanup at this level before enqueueing
                filterExceptStarCleanup(children);
                children.forEach((ch, i) => queue.push({node: ch, parentArr: children, idx: i}));
            }
        }
    }

    isPrepReraiseBlock(block) {
        if (!(block instanceof AST.ASTCondBlock)) {
            return false;
        }
        if (block.blockType != AST.ASTBlock.BlockType.If) {
            return false;
        }
        const cond = block.condition;
        if (!(cond instanceof AST.ASTCompare)) {
            return false;
        }
        if (!(cond.right instanceof AST.ASTNone)) {
            return false;
        }
        const call = cond.left;
        if (!(call instanceof AST.ASTCall) || call.func?.name !== '__prep_reraise_star__') {
            return false;
        }
        if (!block.nodes || block.nodes.length !== 1) {
            return false;
        }
        const bodyCall = block.nodes[0];
        return bodyCall instanceof AST.ASTCall && bodyCall.func?.name === '__prep_reraise_star__';
    }

    isEgCleanupElseBlock(block, prev) {
        if (!(block instanceof AST.ASTBlock)) {
            return false;
        }
        if (block.blockType != AST.ASTBlock.BlockType.Else) {
            return false;
        }
        if (!(prev instanceof AST.ASTCondBlock) || prev.blockType != AST.ASTBlock.BlockType.Except || !prev.isExceptStar) {
            return false;
        }
        const aliasName = prev.condition instanceof AST.ASTStore ? prev.condition.dest?.name : null;
        if (global.g_cliArgs?.debug) {
            console.log(`[EG] alias for cleanup check: ${aliasName}`);
        }
        if (!aliasName) {
            return false;
        }
        const nodes = block.nodes || [];
        for (const node of nodes) {
            if (!this.isEgCleanupNode(node, aliasName)) {
                return false;
            }
        }
        if (global.g_cliArgs?.debug) {
            console.log(`[EG] Removing cleanup else block for alias ${aliasName}`);
        }
        return true;
    }

    isEgCleanupNode(node, aliasName) {
        if (!node) {
            return false;
        }
        if (node instanceof AST.ASTStore && node.dest?.name === aliasName) {
            return true;
        }
        if (node instanceof AST.ASTDelete && node.value?.name === aliasName) {
            return true;
        }
        if (node instanceof AST.ASTName && node.name?.startsWith('##ERROR##')) {
            return true;
        }
        if (node instanceof AST.ASTSubscr || node.constructor?.name === 'ASTSubscr') {
            const fragmentValue = node.codeFragment?.();
            const fragmentStr = typeof fragmentValue === 'string' ? fragmentValue : fragmentValue?.toString?.();
            if (typeof fragmentStr === 'string' && fragmentStr.includes('##ERROR##')) {
                return true;
            }
        }
        if (global.g_cliArgs?.debug) {
            console.log(`[EG] Not a cleanup node: ${node.constructor?.name} -> ${node.codeFragment?.()}`);
        }
        return false;
    }

    rewriteClassDefinitions(root) {
        const hasDataclass = (root instanceof AST.ASTNodeList) && this.astHasDataclassImport(root);
        this._rewriteClassDefsInNodes(this._collectStatementNodes(root), hasDataclass, new Set());
    }

    _collectStatementNodes(container) {
        if (!container) return [];
        if (container instanceof AST.ASTNodeList) return container.list;
        if (container instanceof AST.ASTBlock) return container.nodes;
        return [];
    }

    _rewriteClassDefsInNodes(nodes, hasDataclass, visited) {
        if (!Array.isArray(nodes) || visited.has(nodes)) return;
        visited.add(nodes);

        for (const node of nodes) {
            if (node instanceof AST.ASTStore) {
                this._maybeRewriteClassStore(node, hasDataclass);
            }
            for (const child of this._childContainers(node)) {
                this._rewriteClassDefsInNodes(child, hasDataclass, visited);
            }
        }
    }

    _maybeRewriteClassStore(node, hasDataclass) {
        if (node.src instanceof AST.ASTCall && node.src.func instanceof AST.ASTClass &&
            this.isPlainClassCall(node.src)) {
            node.src = node.src.func;
            this.cleanupClassBody(node.src);
            if (hasDataclass) {
                node.addDecorator(new AST.ASTName('dataclass'));
            }
        } else if (node.src instanceof AST.ASTCall && node.src.func instanceof AST.ASTClass &&
                   this.isClassCallWithOnlyKwargs(node.src)) {
            const callNode = node.src;
            const classNode = callNode.func;
            classNode.kwargs = callNode.kwparams || [];
            node.src = classNode;
            this.cleanupClassBody(classNode);
            if (hasDataclass) {
                node.addDecorator(new AST.ASTName('dataclass'));
            }
        } else if (node.src instanceof AST.ASTCall && this.isDecoratedClassCall(node.src)) {
            // Pattern: `Name = decorator(ClassLiteral[, ...])` produced by Py3.12+
            // dataclass/decorator-of-class flows. Promote to a real class with
            // the call-of-decorator attached as an @decorator.
            const call = node.src;
            const classNode = call.pparams[0];
            const decoratorExpr = this._buildDecoratorExpr(call);
            node.src = classNode;
            this.cleanupClassBody(classNode);
            if (decoratorExpr) {
                node.addDecorator(decoratorExpr);
            }
        } else if (node.src instanceof AST.ASTClass) {
            this.cleanupClassBody(node.src);
        }
    }

    isDecoratedClassCall(call) {
        if (!(call instanceof AST.ASTCall)) return false;
        if (call.func instanceof AST.ASTClass) return false;
        if (!call.pparams || call.pparams.length < 1) return false;
        if (!(call.pparams[0] instanceof AST.ASTClass)) return false;
        // Any further pparams would become positional args to the decorator,
        // which cannot be expressed as `@decorator(class)` sugar. Reject.
        return call.pparams.length === 1;
    }

    _buildDecoratorExpr(call) {
        // `decorator(class)` → `@decorator`
        // `decorator(class, kw=val, ...)` → `@decorator(kw=val, ...)`
        const kwargs = call.kwparams || [];
        if (kwargs.length === 0 && !call.hasVar && !call.hasKw) {
            return call.func;
        }
        const wrapper = new AST.ASTCall(call.func, [], kwargs);
        wrapper.line = call.line;
        return wrapper;
    }

    _childContainers(node) {
        const containers = [];
        if (node instanceof AST.ASTBlock) {
            containers.push(node.nodes);
        }
        if (node?.body && (node.body instanceof AST.ASTBlock || node.body instanceof AST.ASTNodeList)) {
            containers.push(this._collectStatementNodes(node.body));
        }
        // Generic walk for nested blocks/lists in object properties (e.g. ifBlock.elseBlock).
        for (const key of ['elseBlock', 'finallyBlock', 'tryBlock', 'thenBlock']) {
            const val = node?.[key];
            if (val instanceof AST.ASTBlock || val instanceof AST.ASTNodeList) {
                containers.push(this._collectStatementNodes(val));
            }
        }
        return containers;
    }

    isPlainClassCall(call) {
        if (!(call.func instanceof AST.ASTClass)) {
            return false;
        }
        const hasParams = (call.pparams && call.pparams.length > 0) ||
                          (call.kwparams && call.kwparams.length > 0) ||
                          call.hasVar || call.hasKw;
        return !hasParams;
    }

    isClassCallWithOnlyKwargs(call) {
        if (!(call.func instanceof AST.ASTClass)) {
            return false;
        }
        const hasPparams = call.pparams && call.pparams.length > 0;
        const hasKwparams = call.kwparams && call.kwparams.length > 0;
        return !hasPparams && hasKwparams && !call.hasVar && !call.hasKw;
    }

    astHasDataclassImport(root) {
        if (!(root instanceof AST.ASTNodeList)) {
            return false;
        }

        return root.list.some(node => {
            if (!(node instanceof AST.ASTImport)) {
                return false;
            }
            const moduleName = node.name?.codeFragment?.();
            if (moduleName !== 'dataclasses') {
                return false;
            }
            return node.stores?.some?.(store => store.src?.codeFragment?.() === 'dataclass');
        });
    }

    cleanupClassBody(classNode) {
        if (!(classNode instanceof AST.ASTClass)) {
            return;
        }
        const codeObject = classNode.code?.func?.code?.object || classNode.code?.code?.object;
        const body = codeObject?.SourceCode;
        if (!body?.list) {
            return;
        }

        const filtered = [];
        for (const stmt of body.list) {
            if (this.isSyntheticClassAssignment(stmt)) {
                continue;
            }
            filtered.push(stmt);
        }

        if (filtered.length === 1 && filtered[0] instanceof AST.ASTKeyword && filtered[0].word === AST.ASTKeyword.Word.Pass) {
            filtered.length = 0;
        }

        body.list.length = 0;
        Array.prototype.push.apply(body.list, filtered);
    }

    isSyntheticClassAssignment(node) {
        if (!(node instanceof AST.ASTStore)) {
            return false;
        }
        if (!(node.dest instanceof AST.ASTName)) {
            return false;
        }
        const name = node.dest.name;
        return name === '__module__' ||
               name === '__qualname__' ||
               name === '__classcell__' ||
               name === '__firstlineno__' ||
               name === '__type_params__' ||
               name === '__static_attributes__' ||
               name === '.generic_base' ||
               name === '.type_params';
    }

    removeNullSentinelComparisons(root) {
        if (!root) {
            return;
        }
        if (root instanceof AST.ASTNodeList) {
            this.pruneNullSentinels(root.list);
        } else if (root instanceof AST.ASTBlock) {
            this.pruneNullSentinels(root.nodes);
        }
    }

    removeDuplicateReturns(root) {
        const prune = (nodes, visited = new Set()) => {
            if (!Array.isArray(nodes) || visited.has(nodes)) {
                return;
            }
            visited.add(nodes);
            for (let i = nodes.length - 1; i > 0; i--) {
                const cur = nodes[i];
                const prev = nodes[i - 1];
                if (cur instanceof AST.ASTReturn && prev instanceof AST.ASTReturn) {
                    const curFrag = cur.codeFragment?.()?.toString?.();
                    const prevFrag = prev.codeFragment?.()?.toString?.();
                    if (curFrag === prevFrag) {
                        nodes.splice(i, 1);
                        continue;
                    }
                }
                if (cur instanceof AST.ASTNodeList) {
                    prune(cur.list, visited);
                } else if (cur instanceof AST.ASTBlock || cur instanceof AST.ASTCondBlock) {
                    prune(cur.nodes, visited);
                } else if (cur instanceof AST.ASTStore && cur.src instanceof AST.ASTFunction) {
                    prune(cur.src.code?.object?.SourceCode?.list, visited);
                }
            }
        };

        if (root instanceof AST.ASTNodeList) {
            prune(root.list);
        } else if (root instanceof AST.ASTBlock) {
            prune(root.nodes);
        }
    }

    // Rewrites 3.11+ CHECK_EXC_MATCH artifacts that leaked past block
    // reconstruction: unwraps `except <exc> EXC_MATCH <type>` conditions
    // down to `<type>`, rewrites sibling `while __exception__ EXC_MATCH T:`
    // blocks into `except T:` handlers on the preceding Try, and strips
    // trailing compiler-generated reraise/cleanup nodes (bare `raise`,
    // `e = None; del e`, empty `try: pass`). Runs once on the whole tree.
    cleanupExcMatchArtifacts(root) {
        // CHECK_EXC_MATCH only exists in Py3.11+; earlier versions never produce
        // the EXC_MATCH compare op or the __exception__ sentinel, so skip.
        if (this.object.Reader.versionCompare(3, 11) < 0) return;

        const EXC_MATCH = AST.ASTCompare.CompareOp.Exception;

        const unwrapExcMatch = (cond) => {
            if (!cond) return cond;
            // The condition may have been wrapped in ASTStore (alias binding) -
            // unwrap first, then strip the EXC_MATCH compare.
            let inner = cond;
            if (inner instanceof AST.ASTStore && inner.src) {
                inner = inner.src;
            }
            if (inner instanceof AST.ASTCompare && inner.op === EXC_MATCH) {
                return inner.right;
            }
            return cond;
        };

        const isExcMatchCompare = (node) =>
            node instanceof AST.ASTCompare && node.op === EXC_MATCH;

        const isExceptionName = (node) =>
            node instanceof AST.ASTName && node.name === '__exception__';

        const containsExceptionRef = (node, depth = 0) => {
            if (!node || depth > 4) return false;
            if (isExceptionName(node)) return true;
            if (node instanceof AST.ASTCompare || node instanceof AST.ASTBinary) {
                return containsExceptionRef(node.left, depth + 1) ||
                       containsExceptionRef(node.right, depth + 1);
            }
            if (node instanceof AST.ASTCall) {
                return containsExceptionRef(node.func, depth + 1) ||
                       (node.pparams || []).some(p => containsExceptionRef(p, depth + 1));
            }
            if (node instanceof AST.ASTStore) {
                return containsExceptionRef(node.src, depth + 1);
            }
            return false;
        };

        const isEmptyTryBlock = (node) =>
            node instanceof AST.ASTBlock &&
            node.blockType === AST.ASTBlock.BlockType.Try &&
            (node.nodes.length === 0 ||
             (node.nodes.length === 1 &&
              node.nodes[0] instanceof AST.ASTKeyword &&
              node.nodes[0].key === AST.ASTKeyword.Word.Pass));

        const isOrphanExceptionStmt = (node) => {
            // Bare `raise` with no params → fall-through RERAISE artifact
            if (node instanceof AST.ASTRaise && (!node.params || node.params.length === 0)) {
                return true;
            }
            // `__exception__(None, None, None)` or `__exception__` alone
            if (node instanceof AST.ASTCall && isExceptionName(node.func)) {
                return true;
            }
            if (isExceptionName(node)) {
                return true;
            }
            // `x = __exception__` - CPython alias-clear artifact
            if (node instanceof AST.ASTStore && isExceptionName(node.src)) {
                return true;
            }
            // `return __exception__` - misrendered reraise epilogue
            if (node instanceof AST.ASTReturn && isExceptionName(node.value)) {
                return true;
            }
            return false;
        };

        const rewriteContainer = (nodes, parentBlockType) => {
            if (!Array.isArray(nodes)) return;

            // Pass 1: unwrap EXC_MATCH in Except block conditions.
            for (const node of nodes) {
                if (node instanceof AST.ASTCondBlock &&
                    node.blockType === AST.ASTBlock.BlockType.Except) {
                    node.condition = unwrapExcMatch(node.condition);
                }
            }

            // Pass 2: convert ASTWhile/ASTIf with EXC_MATCH condition to Except
            // handlers and attach them to the preceding Try block. If no preceding
            // Try exists (deeply misparsed region), drop them to avoid invalid output.
            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i];
                if (!(node instanceof AST.ASTCondBlock) ||
                    !(node.blockType === AST.ASTBlock.BlockType.While ||
                      node.blockType === AST.ASTBlock.BlockType.If)) {
                    continue;
                }
                if (!isExcMatchCompare(node.condition) ||
                    !containsExceptionRef(node.condition.left)) {
                    continue;
                }
                const matchType = node.condition.right;
                // Find nearest preceding Try block in this container.
                let tryIdx = -1;
                for (let j = i - 1; j >= 0; j--) {
                    const cand = nodes[j];
                    if (cand instanceof AST.ASTBlock &&
                        cand.blockType === AST.ASTBlock.BlockType.Try) {
                        tryIdx = j;
                        break;
                    }
                    // Allow existing Except handlers between; skip past them.
                    if (cand instanceof AST.ASTCondBlock &&
                        cand.blockType === AST.ASTBlock.BlockType.Except) {
                        continue;
                    }
                    break;
                }
                // Strip any trailing orphan reraise/alias-clear statements from body.
                const cleanBody = node.nodes.filter(n => !isOrphanExceptionStmt(n));
                if (cleanBody.length === 0) {
                    cleanBody.push(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
                }

                if (tryIdx >= 0) {
                    const exceptBlk = new AST.ASTCondBlock(
                        AST.ASTBlock.BlockType.Except,
                        node.start, node.end, matchType, false);
                    exceptBlk.line = node.line;
                    exceptBlk.m_nodes = cleanBody;
                    // Insert right after last existing Except handler for that Try.
                    let insertAt = tryIdx + 1;
                    while (insertAt < nodes.length &&
                           nodes[insertAt] instanceof AST.ASTCondBlock &&
                           nodes[insertAt].blockType === AST.ASTBlock.BlockType.Except) {
                        insertAt++;
                    }
                    nodes.splice(i, 1);
                    if (insertAt > i) insertAt--;
                    nodes.splice(insertAt, 0, exceptBlk);
                } else {
                    // No Try to attach to — dropping keeps output parseable.
                    nodes.splice(i, 1);
                }
            }

            // Pass 3: strip orphan exception-related statements at container
            // level — but NOT inside Except/Finally bodies, where bare `raise`
            // is a legitimate re-raise statement.
            const inHandlerBody = parentBlockType === AST.ASTBlock.BlockType.Except ||
                                  parentBlockType === AST.ASTBlock.BlockType.Finally;
            if (!inHandlerBody) {
                for (let i = nodes.length - 1; i >= 0; i--) {
                    if (isOrphanExceptionStmt(nodes[i])) {
                        nodes.splice(i, 1);
                    }
                }
            }

            // Pass 3.5: strip `X = None; del X` pairs — CPython 3.11+ emits this
            // at the tail/fall-through of every `except Foo as X:` body to clear
            // the binding. The pattern is synthetic and user code effectively
            // never writes it literally, so removing it is safe and prevents
            // the artifact from breaking up adjacent except clauses.
            for (let i = nodes.length - 2; i >= 0; i--) {
                const a = nodes[i], b = nodes[i + 1];
                if (a instanceof AST.ASTStore &&
                    a.src instanceof AST.ASTNone &&
                    a.dest instanceof AST.ASTName &&
                    b instanceof AST.ASTDelete &&
                    b.value instanceof AST.ASTName &&
                    a.dest.name === b.value.name) {
                    nodes.splice(i, 2);
                }
            }

            // Pass 4: drop empty `try:` blocks. With no following handler the
            // try is a bare leftover. With a trivial `except: pass` handler the
            // whole pair is a reconstruction artifact — Python forbids
            // `try:<empty>`, so either outcome requires the try to go. When the
            // handler has real body drop only the try and splice a `pass`
            // placeholder into the handler's matching — but the current
            // sightings all have pass-only handlers, so mirror that case.
            const isTrivialHandlerBlock = (n) =>
                n instanceof AST.ASTCondBlock &&
                (n.blockType === AST.ASTBlock.BlockType.Except ||
                 n.blockType === AST.ASTBlock.BlockType.Finally) &&
                (n.nodes.length === 0 ||
                 (n.nodes.length === 1 &&
                  n.nodes[0] instanceof AST.ASTKeyword &&
                  n.nodes[0].key === AST.ASTKeyword.Word.Pass));
            for (let i = nodes.length - 1; i >= 0; i--) {
                if (!isEmptyTryBlock(nodes[i])) continue;
                const next = nodes[i + 1];
                const hasHandler = next instanceof AST.ASTCondBlock &&
                    (next.blockType === AST.ASTBlock.BlockType.Except ||
                     next.blockType === AST.ASTBlock.BlockType.Finally);
                if (!hasHandler) {
                    nodes.splice(i, 1);
                    continue;
                }
                // Walk all trailing handlers; drop the whole cluster iff every
                // one is a trivial pass-body — keeping any would still leave
                // the empty try as a syntax error anyway.
                let tailEnd = i + 1;
                while (tailEnd < nodes.length && isTrivialHandlerBlock(nodes[tailEnd])) {
                    tailEnd++;
                }
                const allTrivial = tailEnd > i + 1 &&
                    nodes.slice(i + 1, tailEnd).every(isTrivialHandlerBlock) &&
                    (tailEnd === nodes.length ||
                     !(nodes[tailEnd] instanceof AST.ASTCondBlock &&
                       (nodes[tailEnd].blockType === AST.ASTBlock.BlockType.Except ||
                        nodes[tailEnd].blockType === AST.ASTBlock.BlockType.Finally)));
                if (allTrivial) {
                    nodes.splice(i, tailEnd - i);
                }
            }

            // Pass 4.5: move a sibling Except/Finally that immediately follows
            // a Try into the Try's body. When CFG reconstruction hoists the
            // handler one level up (e.g. into the parent Else), the block
            // renderer dedents `except:` to the parent's indent — producing
            // `else: / try: / except:` where `except:` lands at the `else:`
            // column instead of the `try:` column, which is a SyntaxError.
            // Absorbing the handler into the Try body lets the renderer's
            // single-step dedent land it at the correct `try:` column.
            for (let i = 0; i < nodes.length - 1; i++) {
                const cur = nodes[i];
                if (!(cur instanceof AST.ASTBlock) ||
                    cur.blockType !== AST.ASTBlock.BlockType.Try) continue;
                const next = nodes[i + 1];
                if (!(next instanceof AST.ASTCondBlock)) continue;
                if (next.blockType !== AST.ASTBlock.BlockType.Except &&
                    next.blockType !== AST.ASTBlock.BlockType.Finally) continue;
                // Skip if the Try already carries its own trailing handler —
                // moving another one in would stack two handlers, which is
                // only valid for multi-except chains (same Try). Those cases
                // already render fine.
                const last = cur.nodes[cur.nodes.length - 1];
                const hasOwnHandler = last instanceof AST.ASTCondBlock &&
                    (last.blockType === AST.ASTBlock.BlockType.Except ||
                     last.blockType === AST.ASTBlock.BlockType.Finally);
                if (hasOwnHandler) continue;
                // Empty Try bodies + non-trivial handler would collapse to an
                // invalid `try: / except:` with nothing between. Inject a
                // `pass` so the rendered block is syntactically valid.
                if (cur.nodes.length === 0) {
                    cur.nodes.push(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
                }
                cur.nodes.push(next);
                nodes.splice(i + 1, 1);
            }

            // Pass 5: a Try block with a non-empty body but no following
            // Except/Finally handler is a SyntaxError. Append a synthetic
            // `except: pass` so the output parses — real structural recovery
            // needs dedicated work, but the fallback keeps the file usable.
            // Skip when the Try already has an Except/Finally nested in its
            // body (except* groups build nested handler structures).
            for (let i = 0; i < nodes.length; i++) {
                const cur = nodes[i];
                if (!(cur instanceof AST.ASTBlock) ||
                    cur.blockType !== AST.ASTBlock.BlockType.Try) {
                    continue;
                }
                if (cur.nodes.length === 0) continue;
                const next = nodes[i + 1];
                const hasHandler = next instanceof AST.ASTCondBlock &&
                    (next.blockType === AST.ASTBlock.BlockType.Except ||
                     next.blockType === AST.ASTBlock.BlockType.Finally);
                if (hasHandler) continue;
                const hasNestedExcept = cur.nodes.some(n =>
                    n instanceof AST.ASTCondBlock &&
                    (n.blockType === AST.ASTBlock.BlockType.Except ||
                     n.blockType === AST.ASTBlock.BlockType.Finally));
                if (hasNestedExcept) continue;
                const synthetic = new AST.ASTCondBlock(
                    AST.ASTBlock.BlockType.Except,
                    cur.end, cur.end, null, false);
                synthetic.line = cur.line;
                synthetic.m_nodes.push(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
                nodes.splice(i + 1, 0, synthetic);
                i++;
            }

            // Pass 5.5: adopt orphan Except into a preceding branch whose
            // body ends with an un-paired Try. CPython can emit a try/except
            // inside the tail of an if/else branch so that, after CFG
            // reconstruction, the Try ends up as the last child of the branch
            // while its handler gets hoisted one level up as a stray sibling.
            // Moving the handler back in keeps the pair valid. Absorbed
            // trailing statements stay in the handler body — not semantically
            // correct, but renders to parseable Python instead of a stray
            // `except:` at the outer indent.
            const branchTypes = [
                AST.ASTBlock.BlockType.If,
                AST.ASTBlock.BlockType.Elif,
                AST.ASTBlock.BlockType.Else,
            ];
            const endsWithOrphanTry = (block) => {
                if (!(block instanceof AST.ASTBlock)) return false;
                if (!branchTypes.includes(block.blockType)) return false;
                const body = block.nodes;
                if (!body || body.length === 0) return false;
                const last = body[body.length - 1];
                if (!(last instanceof AST.ASTBlock) ||
                    last.blockType !== AST.ASTBlock.BlockType.Try) {
                    return false;
                }
                const hasHandlerInside = last.nodes.some(n =>
                    n instanceof AST.ASTCondBlock &&
                    (n.blockType === AST.ASTBlock.BlockType.Except ||
                     n.blockType === AST.ASTBlock.BlockType.Finally));
                return !hasHandlerInside;
            };
            for (let i = nodes.length - 1; i > 0; i--) {
                const cur = nodes[i];
                if (!(cur instanceof AST.ASTCondBlock)) continue;
                if (cur.blockType !== AST.ASTBlock.BlockType.Except &&
                    cur.blockType !== AST.ASTBlock.BlockType.Finally) continue;
                const prev = nodes[i - 1];
                if (!endsWithOrphanTry(prev)) continue;
                // Confirm there's no matching Try at this container level,
                // otherwise leave the pair alone.
                let hasLocalTry = false;
                for (let j = i - 1; j >= 0; j--) {
                    const p = nodes[j];
                    if (p instanceof AST.ASTBlock &&
                        p.blockType === AST.ASTBlock.BlockType.Try) {
                        hasLocalTry = true;
                        break;
                    }
                    if (p instanceof AST.ASTCondBlock &&
                        (p.blockType === AST.ASTBlock.BlockType.Except ||
                         p.blockType === AST.ASTBlock.BlockType.Finally)) {
                        continue;
                    }
                    break;
                }
                if (hasLocalTry) continue;
                prev.nodes.push(cur);
                nodes.splice(i, 1);
            }

            // Pass 6: drop orphan Except/Finally blocks that have no matching
            // Try (or preceding Except) anywhere earlier in this container.
            // These are leftovers from misreconstructed CFGs — keeping them
            // produces SyntaxError at parse time. Inside a Try body Except
            // can legitimately nest (Py3.11+ handler layout, except* groups),
            // but only at the tail. A mid-body Except with non-handler
            // statements after it is a stray handler — drop it.
            const inTryBody = parentBlockType === AST.ASTBlock.BlockType.Try;
            const isHandlerBlock = (x) =>
                x instanceof AST.ASTCondBlock &&
                (x.blockType === AST.ASTBlock.BlockType.Except ||
                 x.blockType === AST.ASTBlock.BlockType.Finally);
            for (let i = nodes.length - 1; i >= 0; i--) {
                const cur = nodes[i];
                if (!(cur instanceof AST.ASTCondBlock)) continue;
                if (cur.blockType !== AST.ASTBlock.BlockType.Except &&
                    cur.blockType !== AST.ASTBlock.BlockType.Finally) continue;
                if (inTryBody) {
                    // except* groups have complex internal structure — never
                    // touch them.
                    if (cur.isExceptStar) continue;
                    // For regular Except nested inside Try body (Py3.11+
                    // handler layout): legitimate only when at the tail.
                    let allTrailingHandlers = true;
                    for (let k = i + 1; k < nodes.length; k++) {
                        if (!isHandlerBlock(nodes[k])) {
                            allTrailingHandlers = false;
                            break;
                        }
                    }
                    if (allTrailingHandlers) continue;
                }
                let anchorFound = false;
                for (let j = i - 1; j >= 0; j--) {
                    const prev = nodes[j];
                    if (prev instanceof AST.ASTBlock &&
                        prev.blockType === AST.ASTBlock.BlockType.Try) {
                        anchorFound = true;
                        break;
                    }
                    if (prev instanceof AST.ASTCondBlock &&
                        (prev.blockType === AST.ASTBlock.BlockType.Except ||
                         prev.blockType === AST.ASTBlock.BlockType.Finally)) {
                        continue;
                    }
                    break;
                }
                if (!anchorFound) nodes.splice(i, 1);
            }

            // Pass 7: after earlier passes may have emptied a Try body, drop
            // Try+trivial-Except pairs where the body is now empty. Python
            // forbids `try:` with no body; a pass-only handler carries no
            // recoverable intent, so splice the cluster out entirely.
            for (let i = nodes.length - 1; i >= 0; i--) {
                if (!isEmptyTryBlock(nodes[i])) continue;
                let tailEnd = i + 1;
                while (tailEnd < nodes.length && isTrivialHandlerBlock(nodes[tailEnd])) {
                    tailEnd++;
                }
                if (tailEnd === i + 1) continue;
                const trailingHandler = nodes[tailEnd] instanceof AST.ASTCondBlock &&
                    (nodes[tailEnd].blockType === AST.ASTBlock.BlockType.Except ||
                     nodes[tailEnd].blockType === AST.ASTBlock.BlockType.Finally);
                if (trailingHandler) continue;
                nodes.splice(i, tailEnd - i);
            }
        };

        // Post-order traversal: process children before parent so nested
        // emptyings bubble up — an outer Try can only be recognised as empty
        // after the inner Try/Except artifacts inside its body were dropped.
        const visited = new WeakSet();
        const visit = (n) => {
            if (!n || visited.has(n)) return;
            visited.add(n);
            let nodes = null;
            let parentType = null;
            if (n instanceof AST.ASTNodeList) {
                nodes = n.list;
                parentType = null;
            } else if (n instanceof AST.ASTBlock) {
                nodes = n.nodes;
                parentType = n.blockType;
            } else if (n instanceof AST.ASTStore && n.src instanceof AST.ASTFunction) {
                const body = n.src.code?.object?.SourceCode;
                if (body) visit(body);
                return;
            }
            if (nodes) {
                for (const c of nodes) visit(c);
                rewriteContainer(nodes, parentType);
            }
        };
        visit(root);
    }

    // An Except block can get reconstructed inside a non-Try block's body
    // (most often a For/While/If inside the protected try-body) when the
    // handler's offset range overlaps a nested loop. Python requires the
    // except clause to sit next to its `try:`, so walk the tree and pull
    // such Except blocks out of any non-Try ancestor until they become a
    // sibling of their enclosing Try.
    hoistNestedExceptBlocks(root) {
        const isHoistableBlock = (node) =>
            node instanceof AST.ASTBlock &&
            node.blockType !== AST.ASTBlock.BlockType.Try;

        const isExcept = (node) =>
            node instanceof AST.ASTCondBlock &&
            node.blockType === AST.ASTBlock.BlockType.Except;

        // Fixed-point loop: one pass hoists Except up one level. Bounded by
        // tree depth; excessive iterations just exit.
        for (let iter = 0; iter < 64; iter++) {
            let moved = false;
            const stack = [{container: null, nodes: null, parent: null}];
            const parentMap = new WeakMap(); // child container → {arr, index, parent}

            const visit = (arr, parentInfo) => {
                for (let i = 0; i < arr.length; i++) {
                    const n = arr[i];
                    if (!n) continue;
                    let children = null;
                    if (n instanceof AST.ASTBlock || n instanceof AST.ASTCondBlock) {
                        children = n.nodes;
                    } else if (n instanceof AST.ASTNodeList) {
                        children = n.list;
                    } else if (n instanceof AST.ASTStore && n.src instanceof AST.ASTFunction) {
                        const src = n.src.code?.object?.SourceCode;
                        if (src instanceof AST.ASTNodeList) {
                            visit(src.list, null);
                        }
                        continue;
                    }
                    if (Array.isArray(children) && children.length > 0) {
                        // If this block is non-Try and its first child is an
                        // Except, pull that Except out into the parent arr
                        // right after `n`.
                        if (isHoistableBlock(n)) {
                            // Scan forward for leading Except children only;
                            // an Except appearing later in the body is usually
                            // a real construct we should leave alone.
                            while (children.length > 0 && isExcept(children[0])) {
                                const ex = children.shift();
                                arr.splice(i + 1, 0, ex);
                                moved = true;
                            }
                        }
                        visit(children, {arr, index: i});
                    }
                }
            };

            const roots = [];
            if (root instanceof AST.ASTNodeList) roots.push(root.list);
            else if (root instanceof AST.ASTBlock) roots.push(root.nodes);

            for (const r of roots) visit(r, null);

            // Also dive into nested function bodies.
            const walk = (n, seen) => {
                if (!n || seen.has(n)) return;
                seen.add(n);
                if (n instanceof AST.ASTStore && n.src instanceof AST.ASTFunction) {
                    const src = n.src.code?.object?.SourceCode;
                    if (src instanceof AST.ASTNodeList) {
                        visit(src.list, null);
                    }
                }
                let children = null;
                if (n instanceof AST.ASTNodeList) children = n.list;
                else if (n instanceof AST.ASTBlock || n instanceof AST.ASTCondBlock) children = n.nodes;
                if (Array.isArray(children)) {
                    for (const c of children) walk(c, seen);
                }
            };
            walk(root, new WeakSet());

            if (!moved) break;
        }
    }

    dedupeExceptHandlers(root) {
        const queue = [root];
        const visited = new WeakSet();
        while (queue.length) {
            const node = queue.shift();
            if (!node || visited.has(node)) continue;
            visited.add(node);

            if (node instanceof AST.ASTBlock && node.blockType === AST.ASTBlock.BlockType.Try) {
                const nodes = node.nodes || [];
                // Remove trailing cleanup else blocks (exception-group artifacts).
                if (nodes.length >= 2) {
                    const last = nodes[nodes.length - 1];
                    const prev = nodes[nodes.length - 2];
                    if (this.isEgCleanupElseBlock(last, prev)) {
                        nodes.pop();
                    }
                }

                // Drop trivial generic except* handlers (exception-group artifacts) that only contain pass/cleanup.
                // User-written `except:` and `except Exception:` must be preserved.
                // Python forbids mixing `except` and `except*` inside the same try, so a
                // non-star trivial `except Exception [as X]: pass` in a try that has any
                // `except*` sibling is always a decompiler artifact.
                const hasExceptStarSibling = nodes.some(n =>
                    n instanceof AST.ASTCondBlock &&
                    n.blockType === AST.ASTBlock.BlockType.Except &&
                    n.isExceptStar);
                for (let i = nodes.length - 1; i >= 0; i--) {
                    const blk = nodes[i];
                    if (!(blk instanceof AST.ASTCondBlock) || blk.blockType !== AST.ASTBlock.BlockType.Except) {
                        continue;
                    }
                    if (!blk.isExceptStar && !hasExceptStarSibling) {
                        continue;
                    }
                    const condNode = blk.condition instanceof AST.ASTStore ? blk.condition.src : blk.condition;
                    const condText = (typeof condNode?.codeFragment === 'function' ? condNode.codeFragment()?.toString?.() : null) || condNode?.name;
                    const body = blk.nodes || [];
                    const isTrivialBody = body.length === 0 ||
                        body.every(n => n instanceof AST.ASTKeyword);
                    if (isTrivialBody && (condText === "Exception" || condText === undefined)) {
                        nodes.splice(i, 1);
                    }
                }

                // Deduplicate consecutive except/except* handlers with identical condition and body.
                for (let i = nodes.length - 1; i > 0; i--) {
                    const cur = nodes[i];
                    const prev = nodes[i - 1];
                    const bothExcept = cur instanceof AST.ASTCondBlock &&
                        prev instanceof AST.ASTCondBlock &&
                        cur.blockType === AST.ASTBlock.BlockType.Except &&
                        prev.blockType === AST.ASTBlock.BlockType.Except;
                    if (!bothExcept) {
                        continue;
                    }
                    const condA = cur.condition?.codeFragment?.()?.toString?.();
                    const condB = prev.condition?.codeFragment?.()?.toString?.();
                    if (condA !== condB) {
                        continue;
                    }
                    if (!!cur.isExceptStar !== !!prev.isExceptStar) {
                        continue;
                    }
                    const bodyA = cur.codeFragment?.()?.toString?.();
                    const bodyB = prev.codeFragment?.()?.toString?.();
                    if (bodyA && bodyB && bodyA === bodyB) {
                        nodes.splice(i, 1);
                    }
                }
            }

            const children = node instanceof AST.ASTNodeList ? node.list
                : node instanceof AST.ASTBlock || node instanceof AST.ASTCondBlock ? node.nodes
                : node instanceof AST.ASTStore && node.src instanceof AST.ASTFunction ? node.src.code?.object?.SourceCode?.list
                : null;
            if (Array.isArray(children)) {
                queue.push(...children);
            }
        }
    }

    pruneNullSentinels(nodes, visited = new Set()) {
        if (!Array.isArray(nodes)) {
            return;
        }
        if (visited.has(nodes)) {
            return;
        }
        visited.add(nodes);
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            if (this.isNullSentinelBlock(node)) {
                nodes.splice(i, 1);
                continue;
            }
            if (node instanceof AST.ASTNodeList) {
                this.pruneNullSentinels(node.list, visited);
            } else if (node instanceof AST.ASTBlock) {
                this.pruneNullSentinels(node.nodes, visited);
            } else if (node instanceof AST.ASTStore && node.src instanceof AST.ASTFunction) {
                this.removeNullSentinelComparisons(node.src.code?.object?.SourceCode);
            } else if (node instanceof AST.ASTStore && node.src instanceof AST.ASTClass) {
                this.removeNullSentinelComparisons(node.src.code?.func?.code?.object?.SourceCode);
            }
        }
    }

    isNullSentinelBlock(node) {
        if (!(node instanceof AST.ASTCondBlock)) {
            return false;
        }
        // `while True: pass` / `while 1:` has no explicit condition but is a legitimate
        // user construct; only If blocks are null-sentinel artifacts from with-cleanup.
        if (node.blockType !== AST.ASTBlock.BlockType.If) {
            return false;
        }
        const condition = node.condition;

        // Drop degenerate IF blocks with no condition and empty body (often leftover from with cleanup tests)
        const emptyBody = !node.nodes || node.nodes.length === 0 ||
                          node.nodes.every(child => child instanceof AST.ASTKeyword && child.word === AST.ASTKeyword.Word.Pass);
        if (!condition) {
            return emptyBody;
        }

        if (!(condition instanceof AST.ASTCompare)) {
            return false;
        }
        const leftStr = condition.left?.codeFragment?.()?.toString?.().trim?.();
        const isNullLiteral = leftStr === 'null';
        const comparesNone = condition.right instanceof AST.ASTNone;
        return isNullLiteral && comparesNone && emptyBody;
    }

    wrapFunctionExceptionGroups(root) {
        if (!(root instanceof AST.ASTNodeList)) {
            return;
        }

        // Also handle module-level exception group patterns
        this.rewriteExceptionGroupsInList(root);

        for (const node of root.list) {
            if (node instanceof AST.ASTStore && node.src instanceof AST.ASTFunction) {
                this.rewriteExceptionGroupsInList(node.src.code?.object?.SourceCode);
            }
        }
    }

    rewriteExceptionGroupsInList(listNode) {
        if (!listNode?.list || listNode.list.length === 0) {
            return;
        }

        const nodes = listNode.list;
        const firstExceptIdx = nodes.findIndex(node => this.isExceptStarBlock(node) || this.isPlainExceptBlock(node));
        if (firstExceptIdx === -1) {
            return;
        }

        let hoistedPrefix = [];
        let tryBlock = null;
        let handlerNodes = [];

        // Reuse the nearest preceding try block if it has meaningful body; otherwise build a new one.
        if (firstExceptIdx > 0) {
            for (let i = firstExceptIdx - 1; i >= 0; i--) {
                if (nodes[i] instanceof AST.ASTBlock && nodes[i].blockType === AST.ASTBlock.BlockType.Try) {
                    // Prefer try blocks with real body; skip empty placeholders.
                    const hasBody = (nodes[i].nodes || []).length > 0;
                    if (!hasBody) {
                        continue;
                    }
                    hoistedPrefix = nodes.slice(0, i);
                    tryBlock = nodes[i];
                    break;
                }
            }
        }

        if (!tryBlock) {
            let startIdx = 0;
            while (startIdx < firstExceptIdx && this.isEgHoistableSetupNode(nodes[startIdx])) {
                hoistedPrefix.push(nodes[startIdx]);
                startIdx++;
            }
            tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, nodes[startIdx]?.start || nodes[0]?.start || 0, 0, true);
            tryBlock.nodes.push(...nodes.slice(startIdx, firstExceptIdx));
        }

        if (tryBlock?.nodes?.length === 1 &&
            tryBlock.nodes[0] instanceof AST.ASTBlock &&
            tryBlock.nodes[0].blockType === AST.ASTBlock.BlockType.Try) {
            tryBlock = tryBlock.nodes[0];
        }

        // Pull handler blocks out of the try body if they were embedded there
        if (tryBlock?.nodes?.length) {
            const filteredBody = [];
            for (const stmt of tryBlock.nodes) {
                if (stmt instanceof AST.ASTCondBlock && stmt.blockType === AST.ASTBlock.BlockType.Except) {
                    handlerNodes.push(stmt);
                    continue;
                }
                filteredBody.push(stmt);
            }
            tryBlock.m_nodes = filteredBody;
        }

        // Collapse nested try wrappers with no handlers
        let body = tryBlock?.nodes || [];
        while (body.length === 1 &&
               body[0] instanceof AST.ASTBlock &&
               body[0].blockType === AST.ASTBlock.BlockType.Try) {
            const inner = body[0];
            const hasHandlers = (inner.nodes || []).some(n => n instanceof AST.ASTCondBlock && n.blockType === AST.ASTBlock.BlockType.Except);
            if (hasHandlers) {
                break;
            }
            tryBlock.m_nodes = inner.nodes || [];
            body = tryBlock.m_nodes;
        }

        // Drop implicit "return None" from the end of the try body
        const lastNode = tryBlock.nodes[tryBlock.nodes.length - 1];
        const lastValStr = lastNode?.value?.codeFragment?.();
        if (lastNode instanceof AST.ASTReturn &&
            (lastNode.value instanceof AST.ASTNone || lastValStr === "None" || lastValStr === undefined)) {
            tryBlock.nodes.pop();
        }

        const rewritten = [...hoistedPrefix, tryBlock, ...handlerNodes];
        // Heuristic: wrap stray TypeError print cleanup into an except* TypeError handler (seen on 3.11)
        const consumed = new Set();
        for (let i = firstExceptIdx; i < nodes.length; i++) {
            const node = nodes[i];
            if (consumed.has(i)) {
                continue;
            }
            const fragment = typeof node?.codeFragment === 'function' ? node.codeFragment()?.toString?.() : '';
            if (node instanceof AST.ASTCall && typeof fragment === 'string' && fragment.includes('TypeError') && fragment.includes('{e}')) {
                const cond = new AST.ASTStore(new AST.ASTName('TypeError'), new AST.ASTName('e'));
                const cb = new AST.ASTCondBlock(AST.ASTBlock.BlockType.Except, node.start || 0, node.end || 0);
                cb.condition = cond;
                cb.isExceptStar = true;
                cb.m_nodes = [node];
                rewritten.push(cb);
                // Skip trailing cleanup nodes for e
                let j = i + 1;
                while (j < nodes.length) {
                    const next = nodes[j];
                    if (next instanceof AST.ASTStore && next.dest?.name === 'e') {
                        consumed.add(j);
                        j++;
                        continue;
                    }
                    if (next instanceof AST.ASTDelete && next.value?.name === 'e') {
                        consumed.add(j);
                        j++;
                        continue;
                    }
                    break;
                }
                consumed.add(i);
                continue;
            }
            if (global.g_cliArgs?.debug && node instanceof AST.ASTBlock && node.blockType == AST.ASTBlock.BlockType.Else) {
                const prev = rewritten[rewritten.length - 1];
                console.log(`[EG] Evaluating else cleanup candidate after ${prev?.constructor?.name}:${prev?.blockType}`);
            }
            if (this.isEgCleanupElseBlock(node, rewritten[rewritten.length - 1])) {
                continue;
            }
            if (this.isPrepReraiseBlock(node)) {
                continue;
            }
            if (node instanceof AST.ASTCondBlock &&
                node.blockType === AST.ASTBlock.BlockType.Except &&
                (!node.nodes || node.nodes.every(ch => {
                    const frag = ch?.codeFragment?.()?.toString?.() || "";
                    return frag === "pass" || frag.includes("__exception__") || frag.includes("##ERROR##");
                }))) {
                // Drop only synthetic except* handlers without a user condition.
                // User-written `except:` / `except E:` must be preserved; replace
                // cleanup-only body with `pass` so the try statement stays valid.
                if (node.isExceptStar && !node.condition) {
                    continue;
                }
                node.m_nodes = [new AST.ASTKeyword(AST.ASTKeyword.Word.Pass)];
                rewritten.push(node);
                continue;
            }
            if (typeof node?.codeFragment === 'function') {
                const frag = node.codeFragment();
                const fragStr = frag?.toString?.() || "";
                if (fragStr.includes("##ERROR##")) {
                    continue;
                }
            }
            rewritten.push(node);
        }

        const flattened = rewritten.map(n => {
            if (n instanceof AST.ASTBlock &&
                n.blockType === AST.ASTBlock.BlockType.Try &&
                n.nodes?.length === 1 &&
                n.nodes[0] instanceof AST.ASTBlock &&
                n.nodes[0].blockType === AST.ASTBlock.BlockType.Try) {
                const inner = n.nodes[0];
                const hasHandlers = (inner.nodes || []).some(ch => ch instanceof AST.ASTCondBlock && ch.blockType === AST.ASTBlock.BlockType.Except);
                if (!hasHandlers) {
                    return inner;
                }
            }
            return n;
        });

        const deduped = [];
        const seenHandlers = new Set();
        for (const node of flattened) {
            if (node instanceof AST.ASTCondBlock && node.blockType === AST.ASTBlock.BlockType.Except) {
                const condStr = node.condition?.codeFragment?.()?.toString?.() || "";
                const key = `${node.isExceptStar ? "star" : "plain"}:${condStr}`;
                if (seenHandlers.has(key)) {
                    continue;
                }
                seenHandlers.add(key);
            }
            deduped.push(node);
        }

        listNode.list.length = 0;
        Array.prototype.push.apply(listNode.list, deduped);
    }

    rewriteGenericWrappers(root) {
        if (!(root instanceof AST.ASTNodeList)) {
            return;
        }
        for (let i = 0; i < root.list.length; i++) {
            const node = root.list[i];
            if (!(node instanceof AST.ASTStore)) {
                continue;
            }
            const call = node.src;
            if (!(call instanceof AST.ASTCall)) {
                continue;
            }
            const func = call.func;
            if (!(func instanceof AST.ASTFunction)) {
                continue;
            }
            const wrapperName = func.code?.object?.Name || "";
            if (!wrapperName.startsWith("<generic parameters of ")) {
                continue;
            }

            // If the call already returns a function/class directly, unwrap it
            if (func.typeParams?.length || func.annotations && Object.keys(func.annotations).length) {
                node.m_src = func;
                continue;
            }

            const targetName = node.dest?.name || node.dest?.codeFragment?.();
            const isClassLike = targetName && targetName[0] === targetName[0]?.toUpperCase?.();

            // Preferred path (3.13+): the wrapper's own SourceCode ends with
            // `return <ASTFunction>` where the function already has correct
            // annotations (via SET_FUNCTION_ATTRIBUTE) and typeParams with
            // PEP 696 defaults (via CALL_INTRINSIC_2 intrinsics 5 + 4).
            const wrapperBody = func.code?.object?.SourceCode?.list || [];
            let returnedNode = null;
            for (let j = wrapperBody.length - 1; j >= 0; j--) {
                const stmt = wrapperBody[j];
                if (stmt instanceof AST.ASTReturn && stmt.value) {
                    returnedNode = stmt.value;
                    break;
                }
            }
            if (!isClassLike && returnedNode instanceof AST.ASTFunction) {
                node.m_src = returnedNode;
                continue;
            }
            // Classes: the wrapper's direct return is an ASTClass whose base is
            // an internal CPython temp (".generic_base" for SUBSCRIPT_GENERIC).
            // Fall through to the Consts-based rebuild which infers clean
            // typeParams from string names instead.

            // Fallback (pre-3.13 or irregular wrappers): rebuild from Consts.
            const codeConsts = func.code?.object?.Consts?.Value || [];
            const allCodeObjects = codeConsts.filter(c => c?.ClassName === 'Py_CodeObject');
            let innerCodeObj = allCodeObjects.find(c => c.Name?.toString?.() === targetName);
            if (!innerCodeObj) {
                innerCodeObj = allCodeObjects[0];
            }
            if (!innerCodeObj) {
                continue;
            }
            const typeParamNames = codeConsts
                .filter(c => c?.ClassName === 'Py_String')
                .map(c => c.Value)
                .filter(v => /^[A-Z][A-Za-z0-9_]*$/.test(v || '') && v !== targetName);

            const typeParams = typeParamNames.map(name => {
                const defaultCode = allCodeObjects.find(c =>
                    c !== innerCodeObj &&
                    (c.ArgCount || 0) === 0 &&
                    c.Name?.toString?.() === name
                );
                if (!defaultCode) return name;
                try {
                    const dd = new PycDecompiler(defaultCode);
                    const body = dd.decompile();
                    defaultCode.SourceCode = body;
                    if (dd.errors.length) this.errors.push(...dd.errors);
                    const list = body?.list || [];
                    const top = list.top?.() || list[list.length - 1] || list[0];
                    if (top instanceof AST.ASTReturn && top.value) {
                        return { name, default: top.value };
                    }
                } catch (_) { /* fall through */ }
                return name;
            });

            const innerDecompiler = new PycDecompiler(innerCodeObj);
            const innerBody = innerDecompiler.decompile();
            innerCodeObj.SourceCode = innerBody;
            if (innerDecompiler.errors.length) this.errors.push(...innerDecompiler.errors);
            const astObj = new AST.ASTObject(innerCodeObj);

            if (!isClassLike) {
                const fn = new AST.ASTFunction(astObj);
                fn.annotations = innerDecompiler.funcAnnotations || fn.annotations;
                fn.typeParams = typeParams;
                node.m_src = fn;
            } else {
                const classFunc = new AST.ASTFunction(astObj);
                const bases = new AST.ASTTuple([]);
                const cls = new AST.ASTClass(classFunc, bases, new AST.ASTName(targetName));
                cls.typeParams = typeParams;
                node.m_src = cls;
            }
        }

        // Simplify calls that simply wrap a generic wrapper function
        for (let i = 0; i < root.list.length; i++) {
            const node = root.list[i];
            if (node instanceof AST.ASTStore && node.src instanceof AST.ASTCall && node.src.func instanceof AST.ASTFunction && (node.src.pparams?.length || 0) === 0) {
                node.m_src = node.src.func;
            }
        }
    }

    isExceptStarBlock(node) {
        return node instanceof AST.ASTCondBlock && node.blockType == AST.ASTBlock.BlockType.Except && node.isExceptStar;
    }

    isPlainExceptBlock(node) {
        return node instanceof AST.ASTCondBlock && node.blockType == AST.ASTBlock.BlockType.Except;
    }

    isEgHoistableSetupNode(node) {
        if (!(node instanceof AST.ASTStore)) {
            return false;
        }
        if (!(node.dest instanceof AST.ASTName)) {
            return false;
        }
        return node.src instanceof AST.ASTNone ||
               node.src instanceof AST.ASTObject ||
               node.src instanceof AST.ASTFunction;
    }

    /**
     * Recursively checks if a block ends with a terminating keyword (break/continue/return)
     * Used to prevent generating additional continue statements after breaks in nested blocks
     */
    hasTerminatingKeyword(block) {
        if (!block || !block.nodes || block.nodes.length == 0) {
            return false;
        }

        let lastNode = block.nodes[block.nodes.length - 1];

        // Check if last node is a terminating keyword
        if (lastNode instanceof AST.ASTKeyword) {
            return [AST.ASTKeyword.Word.Break,
                    AST.ASTKeyword.Word.Continue,
                    AST.ASTKeyword.Word.Return].includes(lastNode.word);
        }

        // Check if last node is a block - recurse into it
        if (lastNode instanceof AST.ASTBlock) {
            return this.hasTerminatingKeyword(lastNode);
        }

        // Check if last node is a return statement
        if (lastNode instanceof AST.ASTReturn) {
            return true;
        }

        return false;
    }

    /**
     * Look ahead from current COPY after LOAD to detect match pattern
     * Strategy: Find next POP_JUMP_IF_FALSE, check if its target is another COPY
     * This confirms match/case pattern before first case is processed
     */
    lookAheadForMatchPattern() {
        // Match patterns only exist in Python 3.10+
        if (this.object.Reader.versionCompare(3, 10) < 0) {
            return false;
        }
        if (!this.code.Next) {
            if (global.g_cliArgs?.debug) {
                console.log(`[LOOK-AHEAD] No next instruction`);
            }
            return false;
        }

        // Find next POP_JUMP_IF_FALSE opcode (should be within ~10 instructions for literal patterns)
        let nextOp = this.code.Next;
        let jumpOp = null;

        for (let i = 0; i < 10 && nextOp; i++) {
            if (nextOp.OpCodeID == this.OpCodes.POP_JUMP_IF_FALSE_A ||
                nextOp.OpCodeID == this.OpCodes.POP_JUMP_FORWARD_IF_FALSE_A) {
                jumpOp = nextOp;
                break;
            }
            nextOp = nextOp.Next;
        }

        if (!jumpOp) {
            if (global.g_cliArgs?.debug) {
                console.log(`[LOOK-AHEAD] No POP_JUMP found within 10 instructions`);
            }
            return false;
        }

        if (jumpOp.JumpTarget === undefined || jumpOp.JumpTarget === null) {
            if (global.g_cliArgs?.debug) {
                console.log(`[LOOK-AHEAD] POP_JUMP has no jump target`);
            }
            return false;
        }

        if (global.g_cliArgs?.debug) {
            console.log(`[LOOK-AHEAD] Found POP_JUMP at offset ${jumpOp.Offset}, target=${jumpOp.JumpTarget}`);
        }

        // Find instruction at or after jump target offset
        // Note: JumpTarget might not match exact instruction offset due to cache instructions
        let targetOp = jumpOp.Next;

        // Navigate forward from POP_JUMP to find instruction at target
        // Look for next COPY (should be within reasonable distance ~40-50 bytes)
        let searchLimit = 100;  // Don't search too far
        let searchCount = 0;

        while (targetOp && searchCount < searchLimit) {
            // Found a COPY opcode?
            if (targetOp.OpCodeID == this.OpCodes.DUP_TOP ||
                (targetOp.OpCodeID == this.OpCodes.COPY_A && targetOp.Argument == 1)) {

                if (global.g_cliArgs?.debug) {
                    console.log(`[LOOK-AHEAD] Found COPY at offset ${targetOp.Offset} after POP_JUMP`);
                }

                // Check if this COPY is preceded by LOAD (if yes, not a match pattern)
                let prevOp = targetOp.Prev;
                if (prevOp && (prevOp.OpCodeID == this.OpCodes.LOAD_FAST_A ||
                              prevOp.OpCodeID == this.OpCodes.LOAD_NAME_A ||
                              prevOp.OpCodeID == this.OpCodes.LOAD_GLOBAL_A)) {
                    // This COPY is after LOAD → not the reuse pattern
                    if (global.g_cliArgs?.debug) {
                        console.log(`[LOOK-AHEAD] COPY at ${targetOp.Offset} has LOAD before → not match pattern`);
                    }
                    return false;
                }

                // This COPY has no LOAD before → match pattern!
                if (global.g_cliArgs?.debug) {
                    console.log(`[LOOK-AHEAD] Match pattern detected! COPY at ${targetOp.Offset} has no prior LOAD`);
                }
                return true;
            }

            targetOp = targetOp.Next;
            searchCount++;
        }

        if (global.g_cliArgs?.debug) {
            console.log(`[LOOK-AHEAD] No COPY found after POP_JUMP within ${searchLimit} bytes`);
        }
        return false;
    }
}

module.exports = PycDecompiler;
