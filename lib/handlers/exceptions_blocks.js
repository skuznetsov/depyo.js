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
}

function handleSetupFinallyA() {
    let nextBlock = new AST.ASTContainerBlock(this.code.Current.Offset, this.code.Current.JumpTarget);
    nextBlock.line = this.code.Current.LineNo;
    this.blocks.push(nextBlock);
    this.curBlock = this.blocks.top();

    this.need_try = true;
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
        return;
    }

    if (this.curBlock.nodes.length &&
            this.curBlock.nodes.top() instanceof AST.ASTKeyword) {
        this.curBlock.removeLast();
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
            if (isUninitAsyncFor) {
                let tryBlock = container.nodes[0];
                if (!tryBlock.nodes.empty() && tryBlock.blockType == AST.ASTBlock.BlockType.Try) {
                    let store = tryBlock.nodes[0];
                    if (store) {
                        asyncForBlock.index = store.dest;
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

    if (this.curBlock.blockType == AST.ASTBlock.BlockType.Container) {
        /* This marks the end of the except block(s). */
        let cont = this.curBlock;
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

        this.code.GoNext();
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
    handleLoadAssertionError
};