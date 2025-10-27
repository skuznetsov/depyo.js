const AST = require('../ast/ast_node');

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

function handlePopTop() {
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
    if (!this.curBlock.inited) {
        if (this.curBlock.blockType == AST.ASTBlock.BlockType.With) {
            this.curBlock.expr = value;
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.If && !this.curBlock.condition) {
            this.curBlock.condition = value;
        }
        this.curBlock.init();
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

function handleInstrumentedReturnValueA() {
    this.handleReturnValue();
}

function handleReturnValue() {
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

    let value = this.dataStack.pop();
    if (value == null) {
        value = new AST.ASTNone();
    }
    let node = new AST.ASTReturn(value);
    node.inLambda = this.object.Name == '<lambda>';
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);

    if ([AST.ASTBlock.BlockType.If, AST.ASTBlock.BlockType.Else].includes(this.curBlock.blockType)
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
    let value = new AST.ASTObject(this.code.Current.ConstantObject);
    let node = new AST.ASTReturn(value);
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

function handleSetLinenoA() {}

function handleSetupAnnotations() {
    this.variable_annotations = true;
}

function handleEndAsyncFor() {
    // Python 3.8+ END_ASYNC_FOR opcode
    // For now, this is a no-op as async for handling is done in handleEndFinally
}

module.exports = {
    handleExecStmt,
    handleFormatValueA,
    handlePopTop,
    handlePrintExpr,
    handlePrintItem,
    handlePrintItemTo,
    handlePrintNewline,
    handlePrintNewlineTo,
    handleInstrumentedReturnValueA,
    handleReturnValue,
    handleInstrumentedReturnConstA,
    handleReturnConstA,
    handleSetLinenoA,
    handleSetupAnnotations,
    handleEndAsyncFor
};