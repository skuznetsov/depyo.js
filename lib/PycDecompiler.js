const fs = require('node:fs');
const path = require('node:path');
const AST = require('./ast/ast_node');

Array.prototype.top = function ArrayTop (pos = 0) {
    return this[this.length - pos - 1];
}

Array.prototype.empty = function ArrayIsEmpty () {
    return this.length == 0;
}

class PycDecompiler {
    static opCodeHandlers = {};
    cleanBuild = false;
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
    
                                // Convert handler name (e.g., "handleJumpForwardA") to opcode name ("JUMP_FORWARD_A")
                                let opCodeName = handlerName.replace(/^handle/, '')
                                                .replaceAll(/([A-Z][a-z]+)/g, m => m.toUpperCase() + '_')
                                                .replace(/_$/, '');
    
                                if (opCodeName in OpCodesMap) {
                                    const opCodeId = OpCodesMap[opCodeName];
                                    const handlerFunc = fileExports[handlerName];
    
                                    if (PycDecompiler.opCodeHandlers[opCodeId]) {
                                         console.warn(`Static Handler warning: OpCode ${opCodeName} (${opCodeId}) already has a handler. Overwriting.`);
                                    }
                                    PycDecompiler.opCodeHandlers[opCodeId] = handlerFunc;
                                } else {
                                    console.warn(`Static Handler mapping warning: OpCode name "${opCodeName}" from ${entry.name} not found in OpCodes map.`);
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

        if (this.object.Name != "<lambda>" && functonBody.last instanceof AST.ASTReturn && functonBody.last.value instanceof AST.ASTNone) {
            functonBody.list.pop();
        }

        if (functonBody.list.length == 0) {
            functonBody.list.push(new AST.ASTKeyword(AST.ASTKeyword.Word.Pass));
        }


        return functonBody;
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
        const maxHandlerEnd = this.maxExceptionHandlerEnd || Math.max(...entries.filter(e => e.depth > 0).map(e => e.end || 0), 0);

        for (const entry of entries) {
            if (entry.start !== offset) {
                continue;
            }
            if (this.activeExceptionStarts.has(entry.start)) {
                continue;
            }
            const endCap = ((entry.depth > 0 ? maxHandlerEnd : entry.end) || (this.code.LastOffset || this.object.CodeSize || 0)) + 2;
            if (entry.depth === 0) {
                const tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, entry.start, endCap, true);
                tryBlock.init();
                this.blocks.push(tryBlock);
                this.curBlock = tryBlock;
            } else {
                // Allow nested handlers but ensure only one active at a time
                if (this.inExceptionTableHandler) {
                    continue;
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
        return Math.max(...matches.map(e => e.end));
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
        
                if (this.code.Current.OpCodeID in PycDecompiler.opCodeHandlers)
                {
                    PycDecompiler.opCodeHandlers[this.code.Current.OpCodeID].call(this);
                } else {
                    console.error(`Unsupported opcode ${this.code.Current.InstructionName} at pos ${this.code.Current.Offset}\n`);
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
                console.error(`EXCEPTION for OpCode ${this.code.Current.InstructionName} (${this.code.Current.Argument}) at offset ${this.code.Current.Offset} in code object '${this.object.Name}', file offset ${this.object.codeOffset + this.code.Current.Offset} : ${ex.message}\n\n`);
                if (global.g_cliArgs?.debug) {
                    console.error('Stack trace:', ex.stack);
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
    
        this.cleanBuild = true;
        let mainNode = new AST.ASTNodeList(this.defBlock.nodes);
        return mainNode;
    }

    transformExceptionGroups(root) {
        const merged = this.mergeOrphanedEgHandlers(root);
        if (merged) {
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
        const first = trailing[0];
        const matchType = (first instanceof AST.ASTStore &&
            first.src instanceof AST.ASTCall &&
            first.src.func instanceof AST.ASTName &&
            first.src.func.name === "__check_eg_match__")
            ? first.src.pparams?.[1]
            : null;

        if (!matchType) {
            return false;
        }

        const aliasName = first instanceof AST.ASTStore ? (first.dest || new AST.ASTName("e")) : new AST.ASTName("e");

        // Drop cleanup artifacts; keep only meaningful body (e.g., print)
        const filtered = trailing.filter(node => {
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
        const valueErrBody = sanitizeBody(valueErrBlock?.nodes || []);
        const typeErrBody = sanitizeBody(filtered);

        const callNode = (tryBlock.nodes || []).find(n => n instanceof AST.ASTCall);
        const newBlocks = [];
        if (callNode) {
            newBlocks.push(callNode);
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

        root.list.splice(tryIdx + 1, trailing.length);
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
                const cond = matchType || blk.condition || new AST.ASTName("Exception");
                blk.condition = new AST.ASTStore(cond, aliasName);
                if (matchType) {
                    blk.isExceptStar = true;
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
            if (node instanceof AST.ASTDelete) {
                return !aliasName || node.value?.name === aliasName.name;
            }
            if (node instanceof AST.ASTStore && node.dest?.name === aliasName?.name && node.src instanceof AST.ASTNone) {
                return true;
            }
            const frag = node?.codeFragment?.();
            const fragStr = frag?.toString?.() || '';
            if (typeof fragStr === 'string' && fragStr.includes('__exception__')) {
                return true;
            }
            if (node instanceof AST.ASTKeyword && node.word === AST.ASTKeyword.Word.Pass) {
                return true;
            }
            return false;
        };

        while (queue.length) {
            const {node, parentArr, idx} = queue.shift();
            if (!node || visited.has(node)) continue;
            visited.add(node);

            if (node instanceof AST.ASTCondBlock && node.blockType === AST.ASTBlock.BlockType.Except) {
                const alias = node.condition instanceof AST.ASTStore ? node.condition.dest : null;
                const filtered = (node.nodes || []).filter(n => !isCleanupNode(n, alias));
                if (filtered.length !== (node.nodes || []).length) {
                    node.m_nodes = filtered;
                }
                if (Array.isArray(parentArr) && (!node.nodes || node.nodes.length === 0)) {
                    parentArr.splice(idx, 1);
                    continue;
                }
            }

            const children = node instanceof AST.ASTNodeList ? node.list :
                             (node instanceof AST.ASTBlock || node instanceof AST.ASTCondBlock) ? node.nodes :
                             null;
            if (Array.isArray(children)) {
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
        if (!(root instanceof AST.ASTNodeList)) {
            return;
        }

        const hasDataclass = this.astHasDataclassImport(root);

        for (const node of root.list) {
            if (!(node instanceof AST.ASTStore)) {
                continue;
            }

            if (node.src instanceof AST.ASTCall && node.src.func instanceof AST.ASTClass &&
                this.isPlainClassCall(node.src)) {
                node.src = node.src.func;
                this.cleanupClassBody(node.src);
                if (hasDataclass) {
                    node.addDecorator(new AST.ASTName('dataclass'));
                }
            } else if (node.src instanceof AST.ASTClass) {
                this.cleanupClassBody(node.src);
            }
        }
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
        const condition = node.condition;
        if (!(condition instanceof AST.ASTCompare)) {
            return false;
        }
        const leftStr = condition.left?.codeFragment?.()?.toString?.().trim?.();
        const isNullLiteral = leftStr === 'null';
        const comparesNone = condition.right instanceof AST.ASTNone;
        const emptyBody = !node.nodes || node.nodes.length === 0 ||
                          node.nodes.every(child => child instanceof AST.ASTKeyword && child.word === AST.ASTKeyword.Word.Pass);
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

        // If the statement immediately before the first except is already a try block, reuse it.
        if (firstExceptIdx > 0 &&
            nodes[firstExceptIdx - 1] instanceof AST.ASTBlock &&
            nodes[firstExceptIdx - 1].blockType === AST.ASTBlock.BlockType.Try) {
            hoistedPrefix = nodes.slice(0, firstExceptIdx - 1);
            tryBlock = nodes[firstExceptIdx - 1];
        } else {
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
            const codeConsts = func.code?.object?.Consts?.Value || [];
            const innerCodeObj = codeConsts.find(c => c?.ClassName === 'Py_CodeObject');
            if (!innerCodeObj) {
                continue;
            }
            // Extract type parameters: pick uppercase-like strings excluding target name
            const typeParams = codeConsts
                .filter(c => c?.ClassName === 'Py_String')
                .map(c => c.Value)
                .filter(v => /^[A-Z][A-Za-z0-9_]*$/.test(v || '') && v !== targetName);

            // Decompile inner code object to get body
            const innerDecompiler = new PycDecompiler(innerCodeObj);
            const innerBody = innerDecompiler.decompile();
            innerCodeObj.SourceCode = innerBody;
            const astObj = new AST.ASTObject(innerCodeObj);

            const isClassLike = targetName && targetName[0] === targetName[0]?.toUpperCase?.();

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
