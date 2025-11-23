const AST = require('../ast/ast_node');

function handleBreakLoop() {
    let keywordNode = new AST.ASTKeyword(AST.ASTKeyword.Word.Break);
    keywordNode.line = this.code.Current.LineNo;
    this.curBlock.append(keywordNode);

    // Mark code as unreachable until the end of CURRENT BLOCK (not entire loop)
    // This allows alternative branches (elif/else) to be processed correctly
    //
    // WRONG approach: unreachableUntil = loopBlock.end (too broad, skips elif!)
    // RIGHT approach: unreachableUntil = curBlock.end (only this branch)
    if (this.curBlock.end > this.code.Current.Offset) {
        this.unreachableUntil = this.curBlock.end;

        if (global.g_cliArgs?.debug) {
            console.log(`BREAK at offset ${this.code.Current.Offset}: curBlock=${this.curBlock.type_str} (${this.curBlock.start}-${this.curBlock.end})`);
            console.log(`  Block stack: ${this.blocks.map((b,i) => `[${i}]${b.type_str}(${b.start}-${b.end})`).join(', ')}`);
            console.log(`  Marking unreachable until ${this.unreachableUntil}`);
        }
    }
}

function handleSetupLoopA() {
    if (global.g_cliArgs?.debug) {
        console.log(`[handleSetupLoopA] Creating while at offset ${this.code.Current.Offset}, JumpTarget=${this.code.Current.JumpTarget}`);
        console.log(`  Data stack size: ${this.dataStack.length}`);
        if (this.dataStack.length > 0) {
            let top = this.dataStack.top();
            console.log(`  Stack top: ${top?.constructor?.name} = ${top?.codeFragment ? top.codeFragment() : top}`);
        }
    }

    let nextBlock = new AST.ASTCondBlock(AST.ASTBlock.BlockType.While, this.code.Current.Offset, this.code.Current.JumpTarget, null, false);
    nextBlock.line = this.code.Current.LineNo;
    this.blocks.push(nextBlock);
    this.curBlock = this.blocks.top();
}

function handleContinueLoopA() {
    let node = new AST.ASTKeyword (AST.ASTKeyword.Word.Continue);
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleForIterA() {
    handleInstrumentedForIterA.call(this);
}

function handleInstrumentedForIterA() {
    let iter = this.dataStack.pop(); // Iterable
    /* Pop it? Don't pop it? */

    let start = this.code.Current.Offset;
    let end = 0;
    let line = this.code.Current.LineNo;
    let comprehension = false;

    // before 3.8, there is a SETUP_LOOP instruction with block start and end position,
    //    the this.code.Current.Argument is usually a jump to a POP_BLOCK instruction
    // after 3.8, block extent has to be inferred implicitly; the this.code.Current.Argument is a jump to a position after the for block
    if (this.object.Reader.versionCompare(3, 8) >= 0) {
        end = this.code.Current.Argument;
        if (this.object.Reader.versionCompare(3, 10) >= 0)
            end *= 2; // // BPO-27129
        end += this.code.Next?.Offset;
        [end] = this.code.FindEndOfBlock(end);
        const objName = this.object?.Name;
        comprehension = this.code.Current.Name == "<listcomp>" ||
                        objName == "<listcomp>" ||
                        objName == "<setcomp>" ||
                        objName == "<dictcomp>";
    } else {
        if ((this.dataStack.top() instanceof AST.ASTSet ||
            this.dataStack.top() instanceof AST.ASTList ||
            this.dataStack.top() instanceof AST.ASTMap)
            && this.dataStack.top().values.length == 0) {
            end = this.code.Current.JumpTarget;
            comprehension = true;
        } else {
            let top = this.blocks.top();
            start = top.start;
            end = top.end; // block end position from SETUP_LOOP
            line = top.line;

            if (top.blockType == AST.ASTBlock.BlockType.While) {
                this.blocks.pop();
            } else {
                comprehension = true;
            }
        }
    }

    let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.For, start, end, iter);
    forblk.line = line;
    forblk.comprehension = comprehension;

    if (global.g_cliArgs?.debug) {
        console.log(`[FOR_ITER] Created for block: start=${start}, end=${end}, comprehension=${comprehension}`);
    }

    this.blocks.push(forblk);
    this.curBlock = this.blocks.top();

    this.dataStack.push(null);
}

function handleForLoopA() {
    let curidx = this.dataStack.pop(); // Current index
    let iter = this.dataStack.pop(); // Iterable

    let comprehension = false;
    let top = this.blocks.top();

    if (top.blockType == AST.ASTBlock.BlockType.While) {
        this.blocks.pop();
    } else {
        comprehension = true;
    }
    
    let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.For, this.code.Current.Offset, top.end, iter);
    forblk.line = this.code.Current.LineNo;
    forblk.comprehension = comprehension;
    this.blocks.push(forblk);
    this.curBlock = this.blocks.top();

    this.dataStack.push(iter);
    this.dataStack.push(curidx);
    this.dataStack.push(null);
}

function handleGetAiter() {
    // Logic similar to FOR_ITER_A
    let iter = this.dataStack.pop(); // Iterable

    let start = this.code.Current.Offset;
    let end = 0;
    let line = this.code.Current.LineNo;
    let comprehension = false;

    let top = this.blocks.top();

    // Python 3.8+ removed SETUP_LOOP, so we need to infer the block end
    if (this.object.Reader.versionCompare(3, 8) >= 0 || top.blockType != AST.ASTBlock.BlockType.While) {
        // Python 3.11+: Check exception table first for END_ASYNC_FOR location
        if (this.object.Reader.versionCompare(3, 11) >= 0 && this.object.ExceptionTable && this.object.ExceptionTable.length > 0) {
            if (global.g_cliArgs?.debug) {
                console.log(`[GET_AITER] Python 3.11+ with exception table (${this.object.ExceptionTable.length} entries)`);
                this.object.ExceptionTable.forEach((entry, i) => {
                    console.log(`  Entry ${i}: start=${entry.start}, end=${entry.end}, target=${entry.target}, depth=${entry.depth}`);
                });
            }

            // Find exception handler that covers the async for loop
            // The handler's target offset should point to END_ASYNC_FOR
            // Note: exception table start may be GET_ANEXT (after GET_AITER)
            for (const entry of this.object.ExceptionTable) {
                // Check if this entry covers range starting at/near GET_AITER
                // GET_AITER is at 'start', exception table may start at next instruction
                if (start >= entry.start - 4 && start <= entry.start + 4) {
                    // The target is the exception handler (END_ASYNC_FOR)
                    end = entry.target + 2; // END_ASYNC_FOR is 2 bytes, end is after it

                    if (global.g_cliArgs?.debug) {
                        console.log(`  ✓ Found END_ASYNC_FOR via exception table: target=${entry.target}, end=${end}`);
                    }
                    break;
                }
            }
        }

        // If not found via exception table, fall back to search
        if (end == 0) {
            // Find END_ASYNC_FOR to determine block end
            // Scan forward by offset (not by instruction index)
            let searchOffset = this.code.Next.Offset;
            let searchLimit = 200;
            let searchCount = 0;

            if (global.g_cliArgs?.debug) {
                console.log(`[GET_AITER] Fallback: searching for END_ASYNC_FOR from offset ${searchOffset}`);
                console.log(`  Last offset: ${this.code.LastOffset}, instructions: ${this.code.Instructions.length}`);
            }

        while (searchCount < searchLimit) {
            let instr = this.code.PeekInstructionAtOffset(searchOffset);
            if (!instr) {
                if (global.g_cliArgs?.debug) {
                    console.log(`  No instruction at offset ${searchOffset}, stopping search (searched ${searchCount} bytes)`);
                }
                break;
            }

            if (global.g_cliArgs?.debug && searchCount < 30) {
                console.log(`  [${searchCount}] offset=${instr.Offset}, opcode=${instr.InstructionName}, id=${instr.OpCodeID}, size=${instr.Size}`);
            }

            if (instr.OpCodeID == this.OpCodes.END_ASYNC_FOR) {
                let instrSize = instr.Size || 2;
                end = instr.Offset + instrSize;
                if (global.g_cliArgs?.debug) {
                    console.log(`  ✓ Found END_ASYNC_FOR at offset ${instr.Offset}, size=${instrSize}, end=${end}`);
                }
                break;
            }

            // Python 3.6+ uses 2-byte (word-aligned) instructions
            let instrSize = instr.Size || 2;
            searchOffset += instrSize;
            searchCount += instrSize;

            if (global.g_cliArgs?.debug && searchCount < 10) {
                console.log(`  Next search: offset=${searchOffset}, count=${searchCount}`);
            }
        }

            if (end == 0) {
                if (global.g_cliArgs?.debug) {
                    console.error(`Could not find END_ASYNC_FOR for GET_AITER at offset ${start}`);
                }
                end = this.code.LastOffset + 2; // Conservative fallback: run to end of code
            }
        }

        // Check if this is an async comprehension (generator expression)
        comprehension = this.code.Current.Name &&
                       (this.code.Current.Name.includes("comp>") ||
                        this.code.Current.Name.includes("genexpr>"));

        let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.AsyncFor, start, end, iter);
        forblk.line = line;
        forblk.comprehension = comprehension;
        this.blocks.push(forblk);
        this.curBlock = this.blocks.top();
        this.dataStack.push(null);
    } else if (top.blockType == AST.ASTBlock.BlockType.While) {
        // Python 3.7 and earlier with SETUP_LOOP: SETUP_LOOP creates While block first
        if (global.g_cliArgs?.debug) {
            console.log(`[GET_AITER] Converting While to AsyncFor at offset ${start}, end=${top.end}`);
        }
        this.blocks.pop();
        let forblk = new AST.ASTIterBlock(AST.ASTBlock.BlockType.AsyncFor, top.start, top.end, iter);
        forblk.line = line;
        this.blocks.push(forblk);
        this.curBlock = this.blocks.top();
        this.dataStack.push(null);
    } else {
        console.error(`Unexpected block type for GET_AITER: ${top.type_str} at offset ${start}\n`);
    }
}

function handleGetAnext() {
    let iter = this.dataStack.top();
    let callNode = new AST.ASTCall(new AST.ASTName('await'), [new AST.ASTBinary(iter, new AST.ASTName('__anext__'), AST.ASTBinary.BinOp.Attr)], []);
    callNode.line = this.code.Current.LineNo;
    this.dataStack.push(callNode);
}

function handleGetIter() {
    handleGetYieldFromIter.call(this);
}

function handleGetYieldFromIter() {
    /* We just entirely ignore this */
    if (this.code.Next?.OpCodeID == this.OpCodes.CALL_FUNCTION_A) {
        this.dataStack.push(new AST.ASTIteratorValue(this.dataStack.pop()));
    }
}

function handleEndFor() {
    // Python 3.13+ END_FOR opcode
    // Cleans up after for loop iteration
    // In Python 3.13, FOR_ITER pushes sentinel, END_FOR pops it
    if (global.g_cliArgs?.debug) {
        console.log(`[END_FOR] at offset ${this.code.Current.Offset}`);
    }
    // No-op for decompilation - stack cleanup happens automatically
}

function handleInstrumentedEndForA() {
    // Instrumented variant mirrors END_FOR behavior.
    handleEndFor.call(this);
}

function handleInstrumentedPopIterA() {
    // Instrumentation helper; no stack effect for decompilation.
    if (global.g_cliArgs?.debug) {
        console.log(`[INSTRUMENTED_POP_ITER] at offset ${this.code.Current.Offset}`);
    }
}

module.exports = {
    handleBreakLoop,
    handleContinueLoopA,
    handleEndFor,
    handleInstrumentedEndForA,
    handleInstrumentedPopIterA,
    handleForIterA,
    handleInstrumentedForIterA,
    handleForLoopA,
    handleGetAiter,
    handleGetAnext,
    handleGetIter,
    handleGetYieldFromIter,
    handleSetupLoopA,
};
