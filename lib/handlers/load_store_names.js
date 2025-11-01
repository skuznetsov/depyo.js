const PycDecompiler = require('../PycDecompiler');
const AST = require('../ast/ast_node');

function handleDeleteAttrA() {
    let name = this.dataStack.pop();
    let node = new AST.ASTDelete(new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteGlobalA() {
    this.object.Globals.add(this.code.Current.Name);
    handleDeleteNameA.call(this);
}

function handleDeleteNameA() {
    let varname = this.code.Current.Name;

    if (varname.length >= 2 && varname.startsWith('_[')) {
        /* Don't show deletes that are a result of list comps. */
        return;
    }

    let node = new AST.ASTDelete(new AST.ASTName(varname));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteFastA() {
    let nameNode = new AST.ASTName(this.code.Current.Name);

    if (nameNode.name.startsWith('_[')) {
        /* Don't show deletes that are a result of list comps. */
        return;
    }

    let node = new AST.ASTDelete(nameNode);
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleLoadAttrA() {
    let name = this.dataStack.top();
    if (!(name instanceof AST.ASTImport)) {
        this.dataStack.pop();

        if (this.object.Reader.versionCompare(3, 12) >= 0) {
            if (this.code.Current.Argument & 1) {
                /* Changed in version 3.12:
                If the low bit of namei is set, then a null or self is pushed to the stack
                before the attribute or unbound method respectively. */
                this.dataStack.push(null);
            }
            this.code.Current.Argument >>= 1;
        }

        let node = new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    }
}

function handleLoadConstA() {
    let constantObject = new AST.ASTObject(this.code.Current.ConstantObject);
    constantObject.line = this.code.Current.LineNo;

    if (global.g_cliArgs?.debug) {
        let value = constantObject.object?.ClassName == 'Py_String' ? constantObject.object.Value : constantObject.object?.ClassName;
        console.log(`[LOAD_CONST] offset=${this.code.Current.Offset}, arg=${this.code.Current.Argument}, value=${value}`);
    }

    if (constantObject.object == null || constantObject.object.ClassName == "Py_None") {
        this.dataStack.push(new AST.ASTNone());
    } else if ((constantObject.object.ClassName == "Py_Tuple" ||
            constantObject.object.ClassName == "Py_SmallTuple") &&
            constantObject.object.Value.empty()) {
        let node = new AST.ASTTuple ([]);
        node.line = this.code.Current.LineNo;
        this.dataStack.push(node);
    } else {
        this.dataStack.push(constantObject);
    }
}

function handleLoadDerefA() {
    processLoadDeref.call(this);
}

function handleLoadClassderefA() {
    processLoadDeref.call(this);
}

function processLoadDeref() {
    let varName = this.code.Current.FreeName;
    if (varName.length >= 2 && varName.startsWith('_[')) {
        return;
    }
    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadFastA() {
    let varName = this.code.Current.Name;
    if (varName.length >= 2 && varName.startsWith('_[')) {
        return;
    }

    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadGlobalA() {
    let varName = this.code.Current.Name;
    if (varName.length >= 2 && varName.startsWith('_[')) {
        return;
    }

    if (this.object.Reader.versionCompare(3, 11) >= 0) {
        // Loads the global named co_names[namei>>1] onto the this.dataStack.
        if (this.code.Current.Argument & 1) {
            /* Changed in version 3.11: 
            If the low bit of "NAMEI" (this.code.Current.Argument) is set, 
            then a null is pushed to the stack before the global variable. */
            this.dataStack.push(null);
        }
        this.code.Current.Argument >>= 1;
    }
    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadLocals() {
    let node = new AST.ASTLocals ();
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleStoreLocals() {
    this.dataStack.pop();
}

function handleLoadMethodA() {
    // Behave like LOAD_ATTR
    let name = this.dataStack.pop();
    let node = new AST.ASTBinary (name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadNameA() {
    let varName = this.code.Current.Name;
    if (varName.length >= 2 && varName.startsWith('_[')) {
        return;
    }
    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleStoreAttrA() {
    if (this.unpack) {
        let name = this.dataStack.pop();
        let attrNode = new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);

        let tup = this.dataStack.top();
        if (tup instanceof AST.ASTTuple) {
            tup.add(attrNode);
        } else {
            console.error("Something TERRIBLE happened!\n");
        }

        if (--this.unpack <= 0) {
            this.dataStack.pop();
            let seqNode = this.dataStack.pop();
            if (seqNode instanceof AST.ASTChainStore) {
                seqNode.line = this.code.Current.LineNo;
                this.append_to_chain_store(seqNode, tup);
            } else {
                let node = new AST.ASTStore(seqNode, tup);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    } else {
        let name = this.dataStack.pop();
        let value = this.dataStack.pop();
        let attrNode = new AST.ASTBinary(name, new AST.ASTName(this.code.Current.Name), AST.ASTBinary.BinOp.Attr);
        if (value instanceof AST.ASTChainStore) {
            this.append_to_chain_store(value, attrNode);
        } else {
            let node = new AST.ASTStore(value, attrNode);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }
}

function handleStoreDerefA() {
    if (this.unpack) {
        let nameNode = new AST.ASTName(this.code.Current.FreeName);
        let tupleNode = this.dataStack.top();
        if (tupleNode instanceof AST.ASTTuple)
            tupleNode.add(nameNode);
        else
            console.error("Something TERRIBLE happened!\n");

        if (--this.unpack <= 0) {
            this.dataStack.pop();
            let seqNode = this.dataStack.pop();

            if (seqNode instanceof AST.ASTChainStore) {
                seqNode.line = this.code.Current.LineNo;
                this.append_to_chain_store(seqNode, tupleNode);
            } else {
                let node = new AST.ASTStore(seqNode, tupleNode);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    } else {
        let valueNode = this.dataStack.pop();
        let nameNode = new AST.ASTName(this.code.Current.FreeName);

        if (valueNode instanceof AST.ASTChainStore) {
            this.append_to_chain_store(valueNode, nameNode);
        } else {
            let node = new AST.ASTStore(valueNode, nameNode);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }
    }
}

function handleStoreFastA() {
    processStore.call(this);
}

function handleStoreGlobalA() {
    processStore.call(this);
}

function handleStoreNameA() {
    processStore.call(this);
}

function processStore() {
    if (global.g_cliArgs?.debug && this.code.Current.Name && (this.code.Current.Name === 'b' || this.code.Current.Name === 'i')) {
        console.log(`[processStore] varName=${this.code.Current.Name}, curBlock=${this.curBlock.type_str}, inited=${this.curBlock.inited}, unpack=${this.unpack}`);
        console.log(`  Block stack: ${this.blocks.map((b,i) => `[${i}]${b.type_str}(inited=${b.inited})`).join(' → ')}`);
    }

    // Check if we're inside an uninitialized For/AsyncFor block (could be nested inside try/container)
    let parentForBlock = null;
    for (let i = this.blocks.length - 1; i >= 0; i--) {
        if ((this.blocks[i].blockType == AST.ASTBlock.BlockType.For ||
             this.blocks[i].blockType == AST.ASTBlock.BlockType.AsyncFor) &&
            !this.blocks[i].inited) {
            parentForBlock = this.blocks[i];
            break;
        }
    }

    if (this.unpack) {
        let nameNode = new AST.ASTName(this.code.Current.Name);

        let tupleNode = this.dataStack.top();
        if (tupleNode instanceof AST.ASTTuple) {
            if (this.starPos-- == 0) {
                nameNode.name = '*' + nameNode.name;
            }
            tupleNode.add(nameNode);
        } else {
            console.error("Something TERRIBLE happened!\n");
        }
        
        if (--this.unpack <= 0) {
            this.dataStack.pop();
            let seqNode = this.dataStack.pop();

            if (parentForBlock) {
                let tuple = tupleNode;
                if (tuple != null) {
                    tuple.requireParens = false;
                }
                parentForBlock.index = tupleNode;
                parentForBlock.init();
            } else if (seqNode instanceof AST.ASTChainStore) {
                seqNode.line = this.code.Current.LineNo;
                this.append_to_chain_store(seqNode, tupleNode);
            } else {
                let node = new AST.ASTStore(seqNode, tupleNode);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    } else {
        let varName = this.code.Current.Name;
        if (varName.length >= 2 && varName.startsWith('_[')) {
            /* Don't show stores of list comp append objects. */
            return;
        }

        // Return private names back to their original name
        let class_prefix = "_" + this.code.Current.Name;
        if (varName.startsWith(class_prefix + "__")) {
            varName.value = varName.substring(class_prefix.length);
        }

        let nameNode = new AST.ASTName(varName);
        nameNode.line = this.code.Current.LineNo;

        // Handle walrus operator (named expression): (n := 10)
        if (this.isWalrusOperator) {
            let valueNode = this.dataStack.pop();
            let namedExpr = new AST.ASTNamedExpr(nameNode, valueNode);
            namedExpr.line = this.code.Current.LineNo;
            this.dataStack.push(namedExpr);
            this.isWalrusOperator = false;
            return;
        }

        if (parentForBlock) {
            if (global.g_cliArgs?.debug && parentForBlock.blockType == AST.ASTBlock.BlockType.AsyncFor) {
                console.log(`[processStore] Setting AsyncFor index to: ${varName}`);
            }
            parentForBlock.index = nameNode;
            parentForBlock.init();
        } else if (this.dataStack.top() instanceof AST.ASTImport) {
            let valueNode = this.dataStack.pop();
            let importNode = this.dataStack.top();
            let storeNode = new AST.ASTStore(valueNode, nameNode);
            storeNode.line = this.code.Current.LineNo;
            importNode.add_store(storeNode);
        } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.With
                    && !this.curBlock.inited) {
            let valueNode = this.dataStack.pop();
            this.curBlock.expr = valueNode;
            this.curBlock.var = nameNode;
            this.curBlock.init();
        } else if (this.dataStack.top() instanceof AST.ASTChainStore) {
            let valueNode = this.dataStack.pop();
            this.append_to_chain_store(valueNode, nameNode);
            if (this.code.Prev.OpCodeID != this.OpCodes.DUP_TOP) {
                this.curBlock.append(valueNode);
            }
        } else {
            let valueNode = this.dataStack.pop();
            if (valueNode instanceof AST.ASTFunction && !valueNode.code.object.SourceCode) {
                let decompiler = new PycDecompiler(valueNode.code.object);
                valueNode.code.object.SourceCode = decompiler.decompile();
            }
            let lastBlockNode = this.curBlock.nodes.top();
            if (
                lastBlockNode instanceof AST.ASTCondBlock &&
                lastBlockNode.nodes.length == 0 &&
                this.code.Current.LineNo == lastBlockNode.line &&
                lastBlockNode.line == valueNode.line
            ) {
                valueNode = new AST.ASTBinary(lastBlockNode.condition, valueNode, lastBlockNode.negative ? AST.ASTBinary.BinOp.LogicalOr : AST.ASTBinary.BinOp.LogicalAnd);
                this.curBlock.nodes.pop();
            }
            let node = new AST.ASTStore(valueNode, nameNode);
            node.line = this.code.Current.LineNo;
            this.curBlock.append(node);
        }

        if (this.code.Current.OpCodeID == this.OpCodes.STORE_GLOBAL_A) {
            this.object.Globals.add(nameNode.name);
        }
    }
}

function handleReserveFastA() {
    let list = [];
    this.code.Current.ConstantObject.Value.map(el => list[el.value] = el.key);
    this.dataStack.push(list);
}

function handleLoadFastBorrowA() {
    // Python 3.14+ LOAD_FAST_BORROW - optimized LOAD_FAST
    handleLoadFastA.call(this);
}

function handleLoadSmallIntA() {
    // Python 3.14+ LOAD_SMALL_INT - loads small integer constant
    const PythonObject = require('../PythonObject').PythonObject;
    let value = this.code.Current.Argument;
    let node = new AST.ASTObject(new PythonObject("Py_Int", value));
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

module.exports = {
    handleDeleteAttrA,
    handleDeleteGlobalA,
    handleDeleteNameA,
    handleDeleteFastA,
    handleLoadAttrA,
    handleLoadConstA,
    handleLoadDerefA,
    handleLoadClassderefA,
    handleLoadFastA,
    handleLoadFastBorrowA,
    handleLoadGlobalA,
    handleLoadLocals,
    handleLoadSmallIntA,
    handleStoreLocals,
    handleLoadMethodA,
    handleLoadNameA,
    handleStoreAttrA,
    handleStoreDerefA,
    handleStoreFastA,
    handleStoreGlobalA,
    handleStoreNameA,
    handleReserveFastA
};