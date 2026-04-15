const AST = require('../ast/ast_node');

/**
 * Helper function to extract WITH statement pattern from bytecode
 * Pattern (Python 2.6-3.1 with SETUP_FINALLY, Python 3.2+ with SETUP_WITH):
 *
 * LOAD_*         (context manager)
 * DUP_TOP
 * LOAD_ATTR      (__exit__)
 * STORE_FAST     (temp var)
 * LOAD_ATTR      (__enter__)
 * CALL_FUNCTION  0
 * STORE_FAST     (temp var 2)
 * SETUP_FINALLY/SETUP_WITH  <- we are here
 * LOAD_FAST      (temp var 2)
 * DELETE_FAST    (temp var 2)
 * [STORE_FAST (variable) | POP_TOP]  <- variable name or no "as" clause
 */
function extractWithPattern() {
    // Look ahead to confirm this is a WITH pattern
    let nextInstr = this.code.Next;
    if (!nextInstr) return null;

    // After SETUP_FINALLY/SETUP_WITH, should have LOAD_FAST + DELETE_FAST
    if (nextInstr.OpCodeID !== this.OpCodes.LOAD_FAST_A) return null;

    let secondInstr = this.code.PeekInstructionAtOffset(nextInstr.Offset + 3);
    if (!secondInstr || secondInstr.OpCodeID !== this.OpCodes.DELETE_FAST_A) return null;

    // Third instruction determines if there's an "as" clause
    let thirdInstr = this.code.PeekInstructionAtOffset(secondInstr.Offset + 3);
    let asVariable = null;

    if (thirdInstr && thirdInstr.OpCodeID === this.OpCodes.STORE_FAST_A) {
        // Has "as variable"
        if (thirdInstr.Name == null) {
            throw new Error(`SETUP_WITH at offset ${this.code.Current.Offset} (file offset ${this.object.codeOffset + this.code.Current.Offset}): STORE_FAST has null Name (expected "as" variable)`);
        }
        asVariable = new AST.ASTName(thirdInstr.Name.toString());
    } else if (thirdInstr && thirdInstr.OpCodeID === this.OpCodes.POP_TOP) {
        // No "as" clause
        asVariable = null;
    } else {
        return null;  // Not a WITH pattern
    }

    // Look backward for the context manager expression
    let ctxMgrExpr = null;

    // Walk back to find LOAD_* instruction (context manager)
    // Scan by instruction index (not offset - instruction sizes vary!)
    for (let idx = this.code.CurrentInstructionIndex - 1; idx >= 0; idx--) {
        let instr = this.code.Instructions[idx];
        if (!instr) continue;

        if ([this.OpCodes.LOAD_FAST_A, this.OpCodes.LOAD_GLOBAL_A, this.OpCodes.LOAD_NAME_A,
             this.OpCodes.LOAD_DEREF_A, this.OpCodes.CALL_FUNCTION, this.OpCodes.CALL_FUNCTION_A,
             this.OpCodes.BINARY_SUBSCR, this.OpCodes.LOAD_ATTR_A].includes(instr.OpCodeID)) {

            // Check if next instruction (by index) is DUP_TOP
            let afterLoad = this.code.Instructions[idx + 1];
            if (afterLoad && afterLoad.OpCodeID === this.OpCodes.DUP_TOP) {
                // Found it! Create AST node for the context manager
                if (instr.OpCodeID === this.OpCodes.LOAD_FAST_A ||
                    instr.OpCodeID === this.OpCodes.LOAD_GLOBAL_A ||
                    instr.OpCodeID === this.OpCodes.LOAD_NAME_A ||
                    instr.OpCodeID === this.OpCodes.LOAD_DEREF_A) {
                    if (instr.Name == null) {
                        throw new Error(`SETUP_WITH at offset ${this.code.Current.Offset} (file offset ${this.object.codeOffset + this.code.Current.Offset}): ${instr.InstructionName} at offset ${instr.Offset} has null Name`);
                    }
                    ctxMgrExpr = new AST.ASTName(instr.Name.toString());
                } else {
                    // CALL_FUNCTION/LOAD_ATTR/BINARY_SUBSCR: reconstructing the
                    // expression without replaying the stack isn't supported yet.
                    throw new Error(`SETUP_WITH at offset ${this.code.Current.Offset} (file offset ${this.object.codeOffset + this.code.Current.Offset}): unsupported context manager opcode ${instr.InstructionName} at offset ${instr.Offset} — needs stack replay`);
                }
                break;
            }
        }
    }

    return {
        contextManager: ctxMgrExpr,
        asVariable: asVariable
    };
}

function handleSetupWithA() {
    let pattern = extractWithPattern.call(this);

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

    if (pattern) {
        withBlock.expr = pattern.contextManager;
        withBlock.var = pattern.asVariable;

        // Skip the pattern instructions (LOAD_FAST, DELETE_FAST, STORE_FAST/POP_TOP)
        // These were already extracted into withBlock.expr and withBlock.var
        this.code.GoNext(); // Skip LOAD_FAST
        this.code.GoNext(); // Skip DELETE_FAST
        this.code.GoNext(); // Skip STORE_FAST or POP_TOP
    }

    this.blocks.push(withBlock);
    this.curBlock = this.blocks.top();
}

function handleWithCleanupStart() {
    handleWithCleanup.call(this);
}

function handleWithCleanup() {
    // Async-with closure runs first because the 3.8+ pattern uses BEGIN_FINALLY
    // (no-op handler) instead of LOAD_CONST None — so the data stack may be
    // empty when WITH_CLEANUP_START fires. Don't gate on the None pop here.
    if (this.curBlock.blockType == AST.ASTBlock.BlockType.AsyncWith
            && this.curBlock.end == this.code.Current.Offset) {
        let asyncWithBlock = this.curBlock;

        // Skip the standard 4-op cleanup epilogue:
        //   GET_AWAITABLE, LOAD_CONST None, YIELD_FROM, WITH_CLEANUP_FINISH
        let standardEpilogue = [
            this.OpCodes.GET_AWAITABLE,
            this.OpCodes.LOAD_CONST_A,
            this.OpCodes.YIELD_FROM,
            this.OpCodes.WITH_CLEANUP_FINISH,
        ];
        for (let expectedOp of standardEpilogue) {
            if (this.code.Next?.OpCodeID === expectedOp) {
                this.code.GoNext();
            } else {
                break;
            }
        }

        // After the standard epilogue, two patterns are possible (3.8+):
        //   Normal exit:        END_FINALLY
        //   Early return path:  POP_FINALLY 0 / LOAD_CONST X / RETURN_VALUE
        //                       / WITH_CLEANUP_START / GET_AWAITABLE / LOAD_CONST None
        //                       / YIELD_FROM / WITH_CLEANUP_FINISH / END_FINALLY
        //                       [/ LOAD_CONST None / RETURN_VALUE  -- dead implicit return]
        // For the early-return case we synthesize the explicit return into the body
        // and skip the trailing exception handler + dead implicit return.
        let after = this.code.Next;
        if (after?.OpCodeID === this.OpCodes.POP_FINALLY_A
                || after?.OpCodeID === this.OpCodes.POP_FINALLY) {
            this.code.GoNext();

            let loadConst = this.code.Next;
            let returnValue = this.code.PeekNextInstruction(2);
            if (loadConst?.OpCodeID === this.OpCodes.LOAD_CONST_A
                    && returnValue?.OpCodeID === this.OpCodes.RETURN_VALUE) {
                let constObj = new AST.ASTObject(loadConst.ConstantObject);
                constObj.line = loadConst.LineNo;
                let retValue;
                if (constObj.object == null || constObj.object.ClassName == "Py_None") {
                    retValue = new AST.ASTNone();
                } else {
                    retValue = constObj;
                }
                let retNode = new AST.ASTReturn(retValue);
                retNode.line = loadConst.LineNo;
                asyncWithBlock.append(retNode);
                this.code.GoNext();
                this.code.GoNext();
            }

            let exceptionHandler = [
                this.OpCodes.WITH_CLEANUP_START,
                this.OpCodes.GET_AWAITABLE,
                this.OpCodes.LOAD_CONST_A,
                this.OpCodes.YIELD_FROM,
                this.OpCodes.WITH_CLEANUP_FINISH,
                this.OpCodes.END_FINALLY,
            ];
            for (let expectedOp of exceptionHandler) {
                if (this.code.Next?.OpCodeID === expectedOp) {
                    this.code.GoNext();
                } else {
                    break;
                }
            }

            // Skip the dead implicit LOAD_CONST None / RETURN_VALUE if it's
            // the very tail of the function (no more instructions after).
            let load = this.code.Next;
            let ret = this.code.PeekNextInstruction(2);
            let beyond = this.code.PeekNextInstruction(3);
            if (load?.OpCodeID === this.OpCodes.LOAD_CONST_A
                    && ret?.OpCodeID === this.OpCodes.RETURN_VALUE
                    && beyond == null) {
                this.code.GoNext();
                this.code.GoNext();
            }
        } else if (after?.OpCodeID === this.OpCodes.END_FINALLY) {
            this.code.GoNext();
        }

        this.blocks.pop();
        this.curBlock = this.blocks.top();
        this.curBlock.append(asyncWithBlock);

        if (global.g_cliArgs?.debug) {
            console.log(`ASYNC WITH block closed, nodes count=${asyncWithBlock.nodes.length}`);
        }
        return;
    }

    // Stack top should be a None. Ignore it.
    let none = this.dataStack.pop();

    if (global.g_cliArgs?.debug) {
        console.log(`WITH_CLEANUP at offset ${this.code.Current.Offset}, curBlock=${this.curBlock.type_str}, end=${this.curBlock.end}, stackTop=${none?.constructor.name}`);
    }

    if (!(none instanceof AST.ASTNone)) {
        if (global.g_cliArgs?.debug) {
            console.error("Something TERRIBLE happened!\n");
        }
        return;
    }

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.With
            && this.curBlock.end == this.code.Current.Offset) {
        let withBlock = this.curBlock;
        this.blocks.pop();  // Remove WITH block from stack
        this.curBlock = this.blocks.top();  // Get parent block
        this.curBlock.append(withBlock);

        if (global.g_cliArgs?.debug) {
            console.log(`WITH block closed successfully, nodes count=${withBlock.nodes.length}, expr=${withBlock.expr?.name}, var=${withBlock.var?.name}`);
            console.log(`  Added to ${this.curBlock.type_str} block`);
        }
    }
    else {
        if (global.g_cliArgs?.debug) {
            console.error(`WITH_CLEANUP mismatch: curBlock.type=${this.curBlock.type_str}, curBlock.end=${this.curBlock.end}, currentOffset=${this.code.Current.Offset}`);
            console.error(`Something TERRIBLE happened! No matching with block found for WITH_CLEANUP at ${this.code.Current.Offset}\n`);
        }
    }
}

function handleWithCleanupFinish() {
            /* Ignore this */
}

/**
 * Handler for BEFORE_WITH opcode (Python 3.11+)
 *
 * In Python 3.11+, context managers use BEFORE_WITH instead of SETUP_WITH.
 * BEFORE_WITH:
 *   - Pops the context manager from the stack
 *   - Calls __enter__() on it
 *   - Pushes the result (which the next STORE_* will capture as the 'as' variable)
 *
 * The with block boundaries come from the exception table, not from jump targets.
 */
function handleBeforeWith() {
    // Pop the context manager from the stack (result of CALL opcode)
    let ctxMgr = this.dataStack.pop();

    if (global.g_cliArgs?.debug) {
        console.log(`[BEFORE_WITH] at offset ${this.code.Current.Offset}, ctxMgr=${ctxMgr?.constructor.name}`);
    }

    // Find the with block end from exception table
    // In Python 3.11+, the exception table entry for with statements has depth=1
    // and covers the range from STORE_* (after BEFORE_WITH) to the end of the body
    let withEnd = this.code.LastOffset;
    const exceptionTable = this.object.ExceptionTable || [];
    const currentOffset = this.code.Current.Offset;

    // Find the exception table entry for this with statement
    // It should start at the STORE_* instruction that follows BEFORE_WITH
    let witchExcTableEntry = null;
    for (const entry of exceptionTable) {
        // Look for entry that starts right after BEFORE_WITH
        // The entry.start is typically the STORE_* instruction offset
        if (entry.start > currentOffset && entry.start <= currentOffset + 10) {
            // Found the exception table entry for this with block
            // The 'end' points to the first instruction AFTER the protected body
            // We use this directly since the pre-handler WITH close logic will
            // close the block when we REACH this offset (before processing)
            withEnd = entry.end || withEnd;
            witchExcTableEntry = entry;
            if (global.g_cliArgs?.debug) {
                console.log(`[BEFORE_WITH] Found exception table entry: start=${entry.start}, end=${entry.end}, withEnd=${withEnd}, target=${entry.target}`);
            }
            break;
        }
    }

    // Mark this exception table entry as belonging to a with statement
    // This prevents it from being treated as a regular exception handler
    if (witchExcTableEntry) {
        witchExcTableEntry._isWithStatement = true;
    }

    // Create the WITH block (uninitialized - processStore will set expr and var)
    let withBlock = new AST.ASTWithBlock(currentOffset, withEnd);
    // Don't set expr here - let processStore do it when it handles the STORE_* instruction
    // This is important because processStore checks for uninitialized WITH blocks

    // Push the __enter__ result to the stack
    // This will be consumed by the subsequent STORE_* instruction (for 'as' variable)
    // The processStore function will pop this and set withBlock.expr and withBlock.var
    this.dataStack.push(ctxMgr);

    // Push the with block onto the block stack
    this.blocks.push(withBlock);
    this.curBlock = this.blocks.top();

    if (global.g_cliArgs?.debug) {
        console.log(`[BEFORE_WITH] Created WITH block (uninitialized), end=${withEnd}, ctxMgr=${ctxMgr?.codeFragment?.()}`);
    }
}

/**
 * Handler for BEFORE_ASYNC_WITH (Python 3.5-3.10).
 *
 * Bytecode pattern for `async with EXPR [as VAR]:`:
 *   LOAD_*               EXPR (context manager)
 *   BEFORE_ASYNC_WITH    <-- we are here
 *   GET_AWAITABLE
 *   LOAD_CONST None
 *   YIELD_FROM
 *   SETUP_ASYNC_WITH +N  (N targets WITH_CLEANUP_START — end of body)
 *   POP_TOP | STORE_FAST VAR
 *   ... body ...
 *   POP_BLOCK
 *   LOAD_CONST None
 *   WITH_CLEANUP_START   (closes block, see handleWithCleanup)
 *   GET_AWAITABLE
 *   LOAD_CONST None
 *   YIELD_FROM
 *   WITH_CLEANUP_FINISH
 *   END_FINALLY
 *
 * We pop the context manager off the data stack, then use GoNext to consume
 * the entire setup epilogue. This bypasses the GET_AWAITABLE / YIELD_FROM
 * handlers (which would otherwise emit `await await(EXPR.__aenter__)` noise)
 * and creates a clean ASTAsyncWithBlock for the body.
 */
function handleBeforeAsyncWith() {
    let ctxMgr = this.dataStack.pop();

    let getAwaitable = this.code.PeekNextInstruction(1);
    let loadNone = this.code.PeekNextInstruction(2);
    let yieldFrom = this.code.PeekNextInstruction(3);
    let setupAsyncWith = this.code.PeekNextInstruction(4);

    if (!getAwaitable || getAwaitable.OpCodeID !== this.OpCodes.GET_AWAITABLE
        || !loadNone || loadNone.OpCodeID !== this.OpCodes.LOAD_CONST_A
        || !yieldFrom || yieldFrom.OpCodeID !== this.OpCodes.YIELD_FROM
        || !setupAsyncWith || setupAsyncWith.OpCodeID !== this.OpCodes.SETUP_ASYNC_WITH_A) {
        throw new Error(`BEFORE_ASYNC_WITH at offset ${this.code.Current.Offset}: expected GET_AWAITABLE/LOAD_CONST/YIELD_FROM/SETUP_ASYNC_WITH sequence, got ${getAwaitable?.InstructionName}/${loadNone?.InstructionName}/${yieldFrom?.InstructionName}/${setupAsyncWith?.InstructionName}`);
    }

    let asClause = this.code.PeekNextInstruction(5);
    let asVar = null;
    let extraSkip = 0;
    if (asClause?.OpCodeID === this.OpCodes.STORE_FAST_A) {
        if (asClause.Name == null) {
            throw new Error(`BEFORE_ASYNC_WITH at offset ${this.code.Current.Offset}: STORE_FAST has null Name (expected "as" variable)`);
        }
        asVar = new AST.ASTName(asClause.Name.toString());
        extraSkip = 1;
    } else if (asClause?.OpCodeID === this.OpCodes.POP_TOP) {
        extraSkip = 1;
    }

    // Walk forward from the body start to find the matching WITH_CLEANUP_START
    // for THIS async-with (not a nested one). Track depth so nested
    // SETUP_WITH/SETUP_ASYNC_WITH are skipped over correctly.
    //
    // Note: SETUP_ASYNC_WITH.JumpTarget is unreliable here — for the early-return
    // pattern it points to the exception-path cleanup, not the normal exit.
    let blockEnd = setupAsyncWith.JumpTarget;
    let depth = 0;
    let searchIdx = this.code.CurrentInstructionIndex + 5 + extraSkip;
    for (let i = searchIdx; i < this.code.Instructions.length; i++) {
        let instr = this.code.Instructions[i];
        if (!instr) break;
        if (instr.OpCodeID === this.OpCodes.SETUP_ASYNC_WITH_A
            || instr.OpCodeID === this.OpCodes.SETUP_WITH_A) {
            depth++;
            continue;
        }
        if (instr.OpCodeID === this.OpCodes.WITH_CLEANUP_START
            || instr.OpCodeID === this.OpCodes.WITH_CLEANUP) {
            if (depth === 0) {
                blockEnd = instr.Offset;
                break;
            }
            depth--;
        }
    }

    // Skip GET_AWAITABLE, LOAD_CONST None, YIELD_FROM, SETUP_ASYNC_WITH, [POP_TOP|STORE_FAST]
    this.code.GoNext(4 + extraSkip);

    let asyncWithBlock = new AST.ASTAsyncWithBlock(this.code.Current.Offset, blockEnd);
    asyncWithBlock.expr = ctxMgr;
    asyncWithBlock.var = asVar;
    asyncWithBlock.init();
    this.blocks.push(asyncWithBlock);
    this.curBlock = this.blocks.top();
}

function handleSetupAsyncWithA() {
    // Normally consumed by handleBeforeAsyncWith via GoNext. If we land here,
    // the lookahead failed — bail silently rather than pushing a malformed block.
    if (global.g_cliArgs?.debug) {
        console.error(`SETUP_ASYNC_WITH at offset ${this.code.Current.Offset}: reached without preceding BEFORE_ASYNC_WITH consumption — ignoring`);
    }
}

module.exports = {
    handleBeforeWith,
    handleBeforeAsyncWith,
    handleSetupWithA,
    handleWithCleanupStart,
    handleWithCleanup,
    handleWithCleanupFinish,
    handleSetupAsyncWithA
};
