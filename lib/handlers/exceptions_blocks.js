const AST = require('../ast/ast_node');

function handleSetupExceptA() {
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container && this.curBlock.line > -1 && this.curBlock.line == this.code.Current.LineNo) {
        this.curBlock.except = this.code.Current.JumpTarget;
    } else if (this.code.Prev?.OpCodeID == this.OpCodes.SETUP_FINALLY_A && this.code.Prev.LineNo > -1 && this.code.Prev.LineNo != this.code.Current.LineNo) {
        let nextBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, this.code.Prev.Offset, this.code.Prev.JumpTarget, true);
        this.blocks.push(nextBlock);
        nextBlock = new AST.ASTContainerBlock(this.code.Current.Offset, 0, this.code.Current.JumpTarget);
        this.blocks.push(nextBlock);
    } else {
        let nextBlock = new AST.ASTContainerBlock(this.code.Current.Offset, 0, this.code.Current.JumpTarget);
        this.blocks.push(nextBlock);
    }

    let tryBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Try, this.code.Current.Offset, this.code.Current.JumpTarget, true);
    this.blocks.push(tryBlock);
    this.curBlock = this.blocks.top();

    this.need_try = false;

    // Register exception handler offset
    if (this.exceptionHandlerOffsets) {
        this.exceptionHandlerOffsets.add(this.code.Current.JumpTarget);

        if (global.g_cliArgs?.debug) {
            console.log(`[SETUP_EXCEPT] Registered exception handler at offset ${this.code.Current.JumpTarget}`);
        }
    }
}

function handleSetupFinallyA() {
    // In Python 2.6-3.1, SETUP_FINALLY is used for WITH statements
    // Try to detect WITH pattern and create ASTWithBlock instead of Container
    let withPattern = extractWithPatternForFinally.call(this);

    if (withPattern) {
        // This is a WITH statement, create ASTWithBlock
        if (global.g_cliArgs?.debug) {
            console.log(`Detected WITH pattern at offset ${this.code.Current.Offset}: expr=${withPattern.contextManager?.name}, var=${withPattern.asVariable?.name}`);
        }

        // Find the WITH_CLEANUP instruction to determine the actual end of the WITH block
        let withEnd = this.code.Current.JumpTarget;
        let searchInstr = this.code.PeekInstructionAtOffset(withEnd);
        for (let i = 0; i < 10 && searchInstr; i++) {
            if (searchInstr.OpCodeID === this.OpCodes.WITH_CLEANUP ||
                searchInstr.OpCodeID === this.OpCodes.WITH_CLEANUP_START ||
                searchInstr.OpCodeID === this.OpCodes.WITH_CLEANUP_FINISH) {
                withEnd = searchInstr.Offset;
                break;
            }
            searchInstr = this.code.PeekInstructionAtOffset(searchInstr.Offset + 3);
        }

        let withBlock = new AST.ASTWithBlock(this.code.Current.Offset, withEnd);
        withBlock.line = this.code.Current.LineNo;

        if (withPattern.contextManager) {
            withBlock.expr = withPattern.contextManager;
            withBlock.var = withPattern.asVariable;
        }

        this.blocks.push(withBlock);
        this.curBlock = this.blocks.top();

        // Skip the pattern instructions (LOAD_FAST, DELETE_FAST, STORE_FAST/POP_TOP/UNPACK_SEQUENCE+STORE_FAST...)
        // These were already extracted into withBlock.expr and withBlock.var
        for (let i = 0; i < withPattern.skipCount; i++) {
            this.code.GoNext();
        }

        if (global.g_cliArgs?.debug) {
            console.log(`After skip (${withPattern.skipCount} instructions): Current=${this.code.Current.Offset}:${this.code.Current.InstructionName}, Next=${this.code.Next?.Offset}:${this.code.Next?.InstructionName}`);
            console.log(`WITH block created: start=${withBlock.start}, end=${withBlock.end}, expr=${withBlock.expr?.name}, var=${withBlock.var?.name}`);
        }
    } else {
        // Normal SETUP_FINALLY for try/finally blocks (or try/except in Python 3.8+)
        let nextBlock = new AST.ASTContainerBlock(this.code.Current.Offset, this.code.Current.JumpTarget);
        nextBlock.line = this.code.Current.LineNo;
        this.blocks.push(nextBlock);
        this.curBlock = this.blocks.top();

        this.need_try = true;

        // Register exception handler offset for Python 3.8+ try-except
        // Target offset may be exception handler (starts with DUP_TOP + LOAD_NAME + COMPARE_OP)
        if (this.exceptionHandlerOffsets) {
            this.exceptionHandlerOffsets.add(this.code.Current.JumpTarget);

            if (global.g_cliArgs?.debug) {
                console.log(`[SETUP_FINALLY] offset=${this.code.Current.Offset}, arg=${this.code.Current.Argument}, JumpTarget=${this.code.Current.JumpTarget}`);
            }
        }
    }
}

/**
 * Helper to extract WITH pattern from SETUP_FINALLY (Python 2.6-3.1)
 * Same pattern as extractWithPattern but callable from exceptions_blocks.js
 */
function extractWithPatternForFinally() {
    // Python 2.6-2.7 pattern: LOAD_FAST → DELETE_FAST → STORE_FAST/POP_TOP
    // Python 3.0+ pattern: Different (LOAD_FAST → LOAD_FAST → CALL_FUNCTION)
    // Strategy: Check backward scan first - if DUP_TOP found, likely WITH statement
    // Then try to extract variable name from forward scan if possible

    // Look ahead to confirm this is a WITH pattern
    let nextInstr = this.code.Next;
    if (!nextInstr) {
        if (global.g_cliArgs?.debug) {
            console.log(`WITH pattern check failed: no next instruction`);
        }
        return null;
    }

    // Python 2.7 pattern check
    if (nextInstr.OpCodeID === this.OpCodes.LOAD_FAST_A) {
        let secondInstr = this.code.PeekInstructionAtOffset(nextInstr.Offset + 3);

        // Python 2.7: LOAD_FAST → DELETE_FAST → STORE_FAST/POP_TOP/UNPACK_SEQUENCE
        if (secondInstr && secondInstr.OpCodeID === this.OpCodes.DELETE_FAST_A) {
            // Third instruction determines if there's an "as" clause
            let thirdInstr = this.code.PeekInstructionAtOffset(secondInstr.Offset + 3);
            let asVariable = null;
            let skipCount = 3;  // Default: LOAD_FAST + DELETE_FAST + (STORE_FAST|POP_TOP)

            if (thirdInstr && thirdInstr.OpCodeID === this.OpCodes.STORE_FAST_A) {
                // Has "as variable"
                asVariable = new AST.ASTName(thirdInstr.Name?.toString() || "###FIXME###");
            } else if (thirdInstr && thirdInstr.OpCodeID === this.OpCodes.POP_TOP) {
                // No "as" clause
                asVariable = null;
            } else if (thirdInstr && thirdInstr.OpCodeID === this.OpCodes.UNPACK_SEQUENCE_A) {
                // Tuple unpacking: with expr as (x, y):
                // Pattern: LOAD_FAST, DELETE_FAST, UNPACK_SEQUENCE n, STORE_FAST..., STORE_FAST...
                // Use placeholder for tuple unpacking (reconstructing tuple is complex)
                asVariable = new AST.ASTName("###FIXME###");
                // Skip LOAD_FAST + DELETE_FAST + UNPACK_SEQUENCE + n STORE_FAST instructions
                skipCount = 3 + (thirdInstr.Argument || 2);
            } else {
                if (global.g_cliArgs?.debug) {
                    console.log(`WITH pattern (Python 2.7) check failed: third=${thirdInstr?.InstructionName}`);
                }
                return null;
            }

            // Python 2.7 pattern matched - proceed with backward scan
            let ctxMgrExpr = extractContextManager.call(this);

            return {
                contextManager: ctxMgrExpr,
                asVariable: asVariable,
                skipCount: skipCount
            };
        }
    }

    // Python 3.0+ pattern: Different forward sequence
    // Try backward scan - if DUP_TOP found, assume WITH statement
    if (global.g_cliArgs?.debug) {
        console.log(`Trying Python 3.0+ WITH pattern detection at offset ${this.code.Current.Offset}`);
        console.log(`  Next 5 instructions:`);
        for (let i = 0; i < 5; i++) {
            let instr = this.code.PeekInstructionAtOffset(this.code.Next.Offset + i * 3);
            if (instr) {
                console.log(`    [+${i}] ${instr.Offset}: ${instr.InstructionName} arg=${instr.Argument} name=${instr.Name}`);
            }
        }
    }

    let ctxMgrExpr = extractContextManager.call(this);

    if (ctxMgrExpr) {
        // Found context manager via backward scan
        // CRITICAL: Before accepting as WITH statement, check if this is actually try-except
        // Python 3.8: try-except uses SETUP_FINALLY, but handler has COMPARE_OP (arg=10) for exception match
        // Python 3.8: real WITH uses SETUP_FINALLY, but handler has WITH_CLEANUP_START/FINISH

        let handlerOffset = this.code.Current.JumpTarget;
        if (handlerOffset > 0) {
            // Scan exception handler to distinguish WITH from try-except
            let scanLimit = 10;  // Check first 10 instructions in handler
            for (let i = 0; i < scanLimit; i++) {
                let handlerInstr = this.code.PeekInstructionAtOffset(handlerOffset + i * 2);  // Python 3.6+ uses 2-byte instructions
                if (!handlerInstr) break;

                // Check for COMPARE_OP with arg=10 (exception match) - this means try-except
                if (handlerInstr.OpCodeID === this.OpCodes.COMPARE_OP_A && handlerInstr.Argument === 10) {
                    if (global.g_cliArgs?.debug) {
                        console.log(`False positive: Found COMPARE_OP EXCEPTION MATCH at offset ${handlerInstr.Offset} - this is try-except, not WITH`);
                    }
                    return null;  // Not a WITH statement, it's try-except
                }

                // Check for genuine WITH cleanup opcodes
                if (handlerInstr.OpCodeID === this.OpCodes.WITH_CLEANUP_START ||
                    handlerInstr.OpCodeID === this.OpCodes.WITH_CLEANUP_FINISH) {
                    if (global.g_cliArgs?.debug) {
                        console.log(`Confirmed WITH statement: Found ${handlerInstr.InstructionName} at offset ${handlerInstr.Offset}`);
                    }
                    break;  // Confirmed WITH, continue processing
                }
            }
        }

        // For Python 3.0+, try to extract variable name from forward sequence
        let asVariable = null;
        let skipCount = 0;

        // Python 3.0+ pattern after SETUP_FINALLY: complex setup code before body
        // Strategy: Skip all setup instructions until we find the WITH body start
        // Setup instructions: LOAD_FAST (temp vars), CALL_FUNCTION (__enter__), STORE_FAST (temp)
        // Body starts at: LOAD_FAST (using actual variables), SETUP_FINALLY (nested), or other control flow

        let searchLimit = 15;
        let foundBodyStart = false;

        for (let i = 0; i < searchLimit; i++) {
            let instr = this.code.PeekInstructionAtOffset(this.code.Next.Offset + i * 3);
            if (!instr) break;

            // Check if this is variable assignment (WITH ... as var:)
            if (instr.OpCodeID === this.OpCodes.STORE_FAST_A && i < 5) {
                // Found variable assignment early in sequence
                asVariable = new AST.ASTName(instr.Name?.toString() || "###FIXME###");
                skipCount = i + 1;
                foundBodyStart = true;
                if (global.g_cliArgs?.debug) {
                    console.log(`Python 3.0+ variable found: ${instr.Name} at offset ${instr.Offset}, skipCount=${skipCount}`);
                }
                break;
            }

            // Check for body start markers
            if (instr.OpCodeID === this.OpCodes.SETUP_FINALLY_A ||
                instr.OpCodeID === this.OpCodes.SETUP_WITH_A ||
                (instr.OpCodeID === this.OpCodes.LOAD_FAST_A && i > 3) || // LOAD_FAST after setup
                instr.OpCodeID === this.OpCodes.LOAD_CONST ||
                instr.OpCodeID === this.OpCodes.POP_BLOCK ||
                instr.OpCodeID === this.OpCodes.CONTINUE_LOOP) {
                // Body starts here, no "as" variable
                skipCount = i;
                foundBodyStart = true;
                if (global.g_cliArgs?.debug) {
                    console.log(`Python 3.0+ body start found at offset ${instr.Offset} (${instr.InstructionName}), skipCount=${skipCount}`);
                }
                break;
            }
        }

        if (!foundBodyStart) {
            // Fallback: skip first 3 instructions (common setup pattern)
            skipCount = 3;
            if (global.g_cliArgs?.debug) {
                console.log(`Python 3.0+ using fallback skipCount=3`);
            }
        }

        if (!asVariable) {
            // No variable found - WITH statement without "as" clause
            asVariable = null;
        }

        if (global.g_cliArgs?.debug) {
            console.log(`Python 3.0+ WITH detected: expr=${ctxMgrExpr.name}, var=${asVariable?.name || 'none'}, skip=${skipCount}`);
        }

        return {
            contextManager: ctxMgrExpr,
            asVariable: asVariable,
            skipCount: skipCount
        };
    }

    // No WITH pattern detected
    return null;
}

/**
 * Extract context manager expression by scanning backward for DUP_TOP pattern
 * Common logic for both Python 2.7 and 3.0+
 */
function extractContextManager() {
    let ctxMgrExpr = null;

    if (global.g_cliArgs?.debug) {
        console.log(`Scanning backward from index ${this.code.CurrentInstructionIndex}, offset ${this.code.Current.Offset}`);
    }

    // Walk back to find LOAD_* instruction (context manager)
    // Scan by instruction index (not offset - instruction sizes vary!)
    for (let idx = this.code.CurrentInstructionIndex - 1; idx >= 0; idx--) {
        let instr = this.code.Instructions[idx];
        if (!instr) continue;

        if (global.g_cliArgs?.debug) {
            console.log(`  [${idx}] offset=${instr.Offset}, opcode=${instr.InstructionName} (${instr.OpCodeID})`);
        }

        if ([this.OpCodes.LOAD_FAST_A, this.OpCodes.LOAD_GLOBAL_A, this.OpCodes.LOAD_NAME_A,
             this.OpCodes.LOAD_DEREF_A, this.OpCodes.CALL_FUNCTION, this.OpCodes.CALL_FUNCTION_A,
             this.OpCodes.BINARY_SUBSCR, this.OpCodes.LOAD_ATTR_A].includes(instr.OpCodeID)) {

            // Check if next instruction (by index) is DUP_TOP
            let afterLoad = this.code.Instructions[idx + 1];
            if (global.g_cliArgs?.debug) {
                console.log(`    Candidate! afterLoad=${afterLoad?.Offset}:${afterLoad?.InstructionName}, DUP_TOP=${this.OpCodes.DUP_TOP}`);
            }

            if (afterLoad && afterLoad.OpCodeID === this.OpCodes.DUP_TOP) {
                // Found it! Create AST node for the context manager
                if (global.g_cliArgs?.debug) {
                    console.log(`    FOUND! InstructionArg=${instr.InstructionArg}`);
                }

                if (instr.OpCodeID === this.OpCodes.LOAD_FAST_A ||
                    instr.OpCodeID === this.OpCodes.LOAD_GLOBAL_A ||
                    instr.OpCodeID === this.OpCodes.LOAD_NAME_A ||
                    instr.OpCodeID === this.OpCodes.LOAD_DEREF_A) {
                    ctxMgrExpr = new AST.ASTName(instr.Name?.toString() || "###FIXME###");
                } else {
                    // For CALL_FUNCTION, LOAD_ATTR, etc., use placeholder
                    ctxMgrExpr = new AST.ASTName("###FIXME###");
                }
                break;
            }
        }
    }

    if (global.g_cliArgs?.debug) {
        console.log(`Result: ctxMgrExpr=${ctxMgrExpr?.name}`);
    }

    return ctxMgrExpr;
}

function handlePopBlock() {
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container ||
            this.curBlock.blockType == AST.ASTBlock.BlockType.Finally) {
        /* These should only be popped by an END_FINALLY */
        if (this.code.Prev?.OpCodeID == this.OpCodes.END_FINALLY && this.curBlock.blockType == AST.ASTBlock.BlockType.Container && this.curBlock.finally == this.code.Next.Offset + 3) {
            let finallyBlock = new AST.ASTBlock(AST.ASTBlock.BlockType.Finally, this.curBlock.finally, 0, true);
            this.blocks.push(finallyBlock);
            this.curBlock = this.blocks.top();
            this.code.GoNext();
        }
        return;
    }

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.With) {
        // This should only be popped by a WITH_CLEANUP
        if (global.g_cliArgs?.debug) {
            console.log(`POP_BLOCK on WITH block ignored at offset ${this.code.Current.Offset}`);
        }
        return;
    }

    if (this.curBlock.nodes.length &&
            this.curBlock.nodes.top() instanceof AST.ASTKeyword) {
        // Don't remove keywords from AsyncFor blocks - they're real loop bodies, not placeholders
        if (this.curBlock.blockType !== AST.ASTBlock.BlockType.AsyncFor) {
            this.curBlock.removeLast();
        }
    }

    let tmp = this.blocks.pop();

    if (!this.blocks.empty()) {
        this.curBlock = this.blocks.top();
    }

    if (!this.blocks.empty() && !(tmp.blockType == AST.ASTBlock.BlockType.Else && tmp.nodes.empty())) {
        this.curBlock.append(tmp);
    }

    if ([AST.ASTBlock.BlockType.For, AST.ASTBlock.BlockType.While].includes(tmp.blockType) && tmp.end >= this.code.Next?.Offset) {
        let blkElse = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, tmp.end);
        this.blocks.push(blkElse);
        this.curBlock = this.blocks.top();
    }

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Try
        && tmp.blockType != AST.ASTBlock.BlockType.For
        && tmp.blockType != AST.ASTBlock.BlockType.AsyncFor
        && tmp.blockType != AST.ASTBlock.BlockType.While) {
        tmp = this.curBlock;
        this.blocks.pop();
        this.curBlock = this.blocks.top();

        if (!(tmp.blockType == AST.ASTBlock.BlockType.Else
                && tmp.nodes.empty())) {
            this.curBlock.append(tmp);
        }
    }

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {            
        if (tmp.blockType == AST.ASTBlock.BlockType.Else && !this.curBlock.hasFinally) {

            /* Pop the container */
            let cont = this.curBlock;
            this.blocks.pop();
            this.curBlock = this.blocks.top();
            this.curBlock.append(cont);

        } else if (
            (tmp.blockType == AST.ASTBlock.BlockType.Else && this.curBlock.hasFinally) ||
            (tmp.blockType == AST.ASTBlock.BlockType.Try && !this.curBlock.hasExcept)
        ) {

            let final = new AST.ASTBlock(AST.ASTBlock.BlockType.Finally, tmp.start, tmp.end, true);
            this.blocks.push(final);
            this.curBlock = this.blocks.top();
        }
    }

    if ((this.curBlock.blockType == AST.ASTBlock.BlockType.For ||
            this.curBlock.blockType == AST.ASTBlock.BlockType.AsyncFor)
        && this.curBlock.end == this.code.Next?.Offset) {
        this.blocks.pop();
        this.blocks.top().append(this.curBlock);
        this.curBlock = this.blocks.top();
    }

    if (this.blocks.empty() && tmp.blockType == AST.ASTBlock.BlockType.Main) {
        this.blocks.push(tmp);
        this.curBlock = this.blocks.top();
    }
}

function handlePopExcept() {}

function handleEndFinally() {
    if (global.g_cliArgs?.debug) {
        console.log(`[handleEndFinally] curBlock=${this.curBlock.type_str}, stack depth=${this.blocks.length}`);
    }

    let isFinally = false;
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Finally) {
        let final = this.curBlock;
        this.blocks.pop();

        this.curBlock = this.blocks.top();
        this.curBlock.nodes.push(final);
        isFinally = true;
    } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.Except) {
        this.blocks.pop();
        let prev = this.curBlock;

        let isUninitAsyncFor = false;
        if (this.blocks.top().blockType == AST.ASTBlock.BlockType.Container) {
            let container = this.blocks.pop();
            let asyncForBlock = this.blocks.top();
            isUninitAsyncFor = asyncForBlock.blockType == AST.ASTBlock.BlockType.AsyncFor && !asyncForBlock.inited;

            if (global.g_cliArgs?.debug) {
                console.log(`[handleEndFinally] Container found. Next block: ${asyncForBlock.type_str}, inited=${asyncForBlock.inited}, isUninitAsyncFor=${isUninitAsyncFor}`);
            }

            if (isUninitAsyncFor) {
                let tryBlock = container.nodes[0];
                if (global.g_cliArgs?.debug) {
                    console.log(`  Container has ${container.nodes.length} nodes, first is ${tryBlock?.type_str}`);
                }

                if (!tryBlock.nodes.empty() && tryBlock.blockType == AST.ASTBlock.BlockType.Try) {
                    let store = tryBlock.nodes[0];
                    if (global.g_cliArgs?.debug) {
                        console.log(`  Try block has ${tryBlock.nodes.length} nodes, first is ${store?.constructor.name}`);
                        console.log(`  Store.dest = ${store?.dest?.constructor.name}: ${store?.dest?.codeFragment ? store.dest.codeFragment() : 'no codeFragment'}`);
                    }
                    if (store) {
                        asyncForBlock.index = store.dest;
                        if (global.g_cliArgs?.debug) {
                            console.log(`  Set asyncForBlock.index = ${asyncForBlock.index?.constructor.name}`);
                        }
                    }
                }
                this.curBlock = this.blocks.top();

                if (!this.curBlock.inited) {
                    console.error("Error when decompiling 'async for'.\n");
                }
            } else {
                this.blocks.push(container);
            }
        }

        if (!isUninitAsyncFor) {
            if (!this.curBlock.empty()) {
                this.blocks.top().append(this.curBlock);
            }

            this.curBlock = this.blocks.top();

            /* Turn it into an else statement. */
            if (this.curBlock.end != this.code.Next?.Offset || this.curBlock.hasFinally) {
                let elseblk = new AST.ASTBlock(AST.ASTBlock.BlockType.Else, this.code.Current.Offset, prev.end);
                elseblk.init();
                this.blocks.push(elseblk);
                this.curBlock = this.blocks.top();
            }
        }
    }

    // Handle Python 3.6+ case: curBlock is "if" inside CONTAINER inside initialized AsyncFor
    // This happens because END_FINALLY executes before the "if" block closes
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.If) {
        // Check if we're in the pattern: if → CONTAINER → AsyncFor (initialized)
        if (this.blocks.length >= 3) {
            let parentContainer = this.blocks[this.blocks.length - 2];
            let grandparentAsyncFor = this.blocks[this.blocks.length - 3];

            if (parentContainer?.blockType == AST.ASTBlock.BlockType.Container &&
                grandparentAsyncFor?.blockType == AST.ASTBlock.BlockType.AsyncFor &&
                grandparentAsyncFor.inited) {

                if (global.g_cliArgs?.debug) {
                    console.log(`[handleEndFinally-If] Found if→CONTAINER→AsyncFor(inited) pattern`);
                    console.log(`  Closing if block and will hide CONTAINER`);
                }

                // Close the if block first
                this.blocks.pop();
                // Now curBlock should be CONTAINER - let it fall through to the next check
                this.curBlock = this.blocks.top();
            }
        }
    }

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
        /* This marks the end of the except block(s). */
        let cont = this.curBlock;

        // Set end offset for CONTAINER block (was 0 from constructor)
        if (cont.end === 0) {
            cont.end = this.code.Current.Offset;
            if (global.g_cliArgs?.debug) {
                console.log(`[handleEndFinally-Container] Set end=${cont.end} for CONTAINER(${cont.start}-${cont.end})`);
            }
        }

        // Check if parent is an AsyncFor block (initialized or uninitialized)
        if (this.blocks.length > 1) {
            let parentBlock = this.blocks[this.blocks.length - 2];
            let isUninitAsyncFor = parentBlock &&
                                   parentBlock.blockType == AST.ASTBlock.BlockType.AsyncFor &&
                                   !parentBlock.inited;
            let isInitAsyncFor = parentBlock &&
                                 parentBlock.blockType == AST.ASTBlock.BlockType.AsyncFor &&
                                 parentBlock.inited;

            if (global.g_cliArgs?.debug) {
                console.log(`[handleEndFinally-Container] Parent=${parentBlock?.type_str}, isUninitAsyncFor=${isUninitAsyncFor}, isInitAsyncFor=${isInitAsyncFor}`);
            }

            if (isUninitAsyncFor) {
                // Extract index from Try block inside Container
                if (global.g_cliArgs?.debug) {
                    console.log(`  Container has ${cont.nodes.length} nodes:`);
                    cont.nodes.forEach((n, i) => console.log(`    [${i}] ${n?.type_str || n?.constructor.name}`));
                }

                let tryBlock = cont.nodes.find(n => n.blockType == AST.ASTBlock.BlockType.Try);
                if (global.g_cliArgs?.debug) {
                    console.log(`  TryBlock found: ${!!tryBlock}, nodes: ${tryBlock?.nodes.length}`);
                }

                if (tryBlock && !tryBlock.nodes.empty()) {
                    // Find ASTStore node (the assignment of iterator value to loop variable)
                    const AST = require('../ast/ast_node');
                    let store = tryBlock.nodes.find(n => n instanceof AST.ASTStore);

                    if (global.g_cliArgs?.debug) {
                        console.log(`  Found ASTStore: ${!!store}, has dest: ${!!store?.dest}`);
                        if (store) console.log(`    dest type: ${store.dest?.constructor.name}`);
                    }

                    if (store && store.dest) {
                        parentBlock.index = store.dest;
                        parentBlock.init();
                        if (global.g_cliArgs?.debug) {
                            console.log(`  ✓ Extracted index: ${store.dest.codeFragment?.() || store.dest.constructor.name}`);
                        }

                        // Extract the actual loop body (everything after the store in try block)
                        // Skip yield from / await calls which are implementation details
                        const storeIdx = tryBlock.nodes.indexOf(store);
                        for (let i = storeIdx + 1; i < tryBlock.nodes.length; i++) {
                            let node = tryBlock.nodes[i];
                            // Skip yield from / await implementation
                            if (node && node.constructor.name !== 'ASTReturn') {
                                parentBlock.nodes.push(node);
                            }
                        }

                        if (parentBlock.nodes.length === 0) {
                            // Empty body - add pass
                            const AST = require('../ast/ast_node');
                            let passNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Pass);
                            passNode.line = store.line;
                            parentBlock.nodes.push(passNode);
                        }

                        if (global.g_cliArgs?.debug) {
                            console.log(`  ✓ Added ${parentBlock.nodes.length} node(s) to async for body`);
                        }
                    }
                }
                // Don't append the Container to AsyncFor - it's just implementation detail
                this.blocks.pop();
                this.curBlock = this.blocks.top();
                return;
            }

            if (isInitAsyncFor) {
                // Python 3.6+: AsyncFor already initialized by STORE_FAST
                // Just need to extract loop body and hide CONTAINER
                if (global.g_cliArgs?.debug) {
                    console.log(`  [InitAsyncFor] AsyncFor already has ${parentBlock.nodes.length} nodes`);
                    parentBlock.nodes.forEach((n, i) => console.log(`    Existing[${i}] ${n?.constructor?.name}`));
                    console.log(`  Container has ${cont.nodes.length} nodes:`);
                    cont.nodes.forEach((n, i) => console.log(`    [${i}] ${n?.type_str || n?.constructor.name}`));
                }

                let tryBlock = cont.nodes.find(n => n.blockType == AST.ASTBlock.BlockType.Try);
                if (tryBlock && !tryBlock.nodes.empty()) {
                    // Find ASTStore node (the STORE_FAST that set the index)
                    const AST = require('../ast/ast_node');

                    if (global.g_cliArgs?.debug) {
                        console.log(`  Try block has ${tryBlock.nodes.length} nodes:`);
                        tryBlock.nodes.forEach((n, i) => console.log(`    [${i}] ${n?.constructor?.name}`));
                    }

                    let store = tryBlock.nodes.find(n => n instanceof AST.ASTStore);

                    // Extract loop body - skip the STORE (which sets the index, already done by processStore)
                    // and skip async implementation details (yield from, await calls without actual code)
                    let startIdx = store ? tryBlock.nodes.indexOf(store) + 1 : 0;

                    for (let i = startIdx; i < tryBlock.nodes.length; i++) {
                        let node = tryBlock.nodes[i];
                        // Skip yield from / await calls which are implementation details
                        // ASTReturn = yield from, ASTCall with await = implementation
                        if (node && node.constructor.name !== 'ASTReturn' &&
                            !(node.constructor.name === 'ASTCall' && node.func?.name === 'await')) {
                            parentBlock.nodes.push(node);
                        }
                    }

                    if (parentBlock.nodes.length === 0) {
                        // Empty body - add pass
                        let passNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Pass);
                        passNode.line = tryBlock.line;
                        parentBlock.nodes.push(passNode);
                    }

                    if (global.g_cliArgs?.debug) {
                        console.log(`  ✓ Added ${parentBlock.nodes.length} node(s) to initialized async for body`);
                    }
                }

                // Don't append the Container to AsyncFor - it's just implementation detail
                this.blocks.pop();
                this.curBlock = this.blocks.top();

                // Close the AsyncFor block immediately - everything after CONTAINER is implementation detail
                if (this.curBlock.blockType == AST.ASTBlock.BlockType.AsyncFor) {
                    let asyncForEnd = this.curBlock.end;
                    this.blocks.pop();
                    this.blocks.top().append(this.curBlock);
                    this.curBlock = this.blocks.top();

                    // Mark everything until the original AsyncFor end as unreachable (implementation details)
                    this.unreachableUntil = asyncForEnd;

                    if (global.g_cliArgs?.debug) {
                        console.log(`  ✓ Closed AsyncFor block early, marking ${this.code.Current.Offset}-${asyncForEnd} as unreachable`);
                    }
                }
                return;
            }
        }

        if (!cont.hasFinally || isFinally) {
            /* If there's no finally block, pop the container. */
            this.blocks.pop();
            this.curBlock = this.blocks.top();
            this.curBlock.append(cont);
        }
        if (cont. hasFinally) {

        }
    }
}

function handleRaiseVarargsA() {
    let paramList = [];
    for (let idx = 0; idx < this.code.Current.Argument; idx++) {
        paramList.unshift(this.dataStack.pop());
    }
    let node = new AST.ASTRaise(paramList);
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);

    if ((this.curBlock.blockType == AST.ASTBlock.BlockType.If
            || this.curBlock.blockType == AST.ASTBlock.BlockType.Else)
            && (this.object.Reader.versionCompare(2, 6) >= 0)) {
        let prev = this.curBlock;
        this.blocks.pop();
        this.curBlock = this.blocks.top();
        this.curBlock.append(prev);

        // REMOVED: this.code.GoNext() - main loop already calls GoNext(), this was causing instructions to be skipped
    }
}

function handleWithExceptStart() {
    // TODO: Adjust your SETUP_WITH_A logic to handle exceptions
    console.log("OpCode WITH_EXCEPT_START needs implementation");
}

function handleLoadAssertionError() {
    this.dataStack.push(new AST.ASTName("AssertionError"));
}

function handleBeginFinally() {
    // I might need to adjust SETUP_FINALLY_A logic based on this
}

function handleCallFinallyA() {
    // TODO: Implement logic for calling finally block
    console.log("OpCode CALL_FINALLY_A needs implementation");
}

function handlePopFinallyA() {
    // Logic might be needed within your END_FINALLY handling
}

function handleReraise() {
    // Python 3.9-3.12 RERAISE opcode
    // Re-raises the current exception in an exception handler
    // For decompilation: usually implicit in exception handler flow
    if (global.g_cliArgs?.debug) {
        console.log(`[RERAISE] at offset ${this.code.Current.Offset}`);
    }
    // In most cases, reraise is implicit when exception handler doesn't catch
    // No explicit AST node needed

    // Code after RERAISE is unreachable
    // Mark as unreachable to prevent further processing
    this.unreachableUntil = this.code.Current.Offset + 1000; // Large number to skip rest
}

function handleReraiseA() {
    // Python 3.10+ RERAISE with argument
    // Argument specifies reraise behavior
    handleReraise.call(this);
}

module.exports = {
    handleEndFinally,
    handlePopBlock,
    handlePopExcept,
    handleRaiseVarargsA,
    handleSetupExceptA,
    handleSetupFinallyA,
    handleBeginFinally,
    handleCallFinallyA,
    handlePopFinallyA,
    handleWithExceptStart,
    handleLoadAssertionError,
    handleReraise,
    handleReraiseA
};