const PycDecompiler = require('../PycDecompiler');
const AST = require('../ast/ast_node');
const { beginMatchCaseFromPattern } = require('./misc_other');

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
    let nameNode = new AST.ASTName(this.code.Current.Name || "");

    if (nameNode.name.startsWith('_[')) {
        /* Don't show deletes that are a result of list comps. */
        return;
    }

    let node = new AST.ASTDelete(nameNode);
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteDerefA() {
    const freeName = this.code.Current.FreeName || "";
    if (!freeName) {
        return;
    }
    let node = new AST.ASTDelete(new AST.ASTName(freeName));
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
    let varName = this.code.Current.FreeName || "";
    if (varName.length >= 2 && varName.startsWith('_[')) {
        return;
    }
    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadFastA() {
    let varName = this.code.Current.Name || "";
    if (varName.length >= 2 && varName.startsWith('_[')) {
        return;
    }

    let node = new AST.ASTName (varName);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleLoadGlobalA() {
    let varName = this.code.Current.Name || "";
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
    let varName = this.code.Current.Name || "";
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
    // Pattern matching: first capture expected bindings, then start case body
    if (this.inMatchPattern) {
        if (shouldCaptureStoreInPattern(this.patternOps)) {
            this.patternOps.push({
                type: 'STORE_FAST',
                name: this.code.Current.Name
            });
            return;
        }

        if (beginMatchCaseFromPattern.call(this, {reason: 'store'})) {
            this.unpack = 0;
            this.starPos = -1;
            // Fall through to normal store handling now that case body started
        }
    }

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
        let varName = this.code.Current.Name || "";
        if (varName.length >= 2 && varName.startsWith('_[')) {
            /* Don't show stores of list comp append objects. */
            return;
        }

        // Return private names back to their original name
        let class_prefix = "_" + varName;
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
        } else {
            let valueNode = this.dataStack.pop();
            let importNode = this.dataStack.top();
            if (importNode instanceof AST.ASTImport) {
                let storeNode = new AST.ASTStore(valueNode, nameNode);
                storeNode.line = this.code.Current.LineNo;
                importNode.add_store?.(storeNode);
                return;
            } else if (importNode instanceof AST.ASTChainStore) {
                // fall through after reusing valueNode
                this.dataStack.pop(); // remove chain store from stack
                this.append_to_chain_store(importNode, nameNode);
                if (this.code.Prev?.OpCodeID != this.OpCodes.DUP_TOP) {
                    this.curBlock.append(importNode);
                }
                return;
            } else if (this.curBlock.blockType == AST.ASTBlock.BlockType.With
                        && !this.curBlock.inited) {
                this.curBlock.expr = valueNode;
                this.curBlock.var = nameNode;
                this.curBlock.init();
                return;
            }

            if (!valueNode) {
                valueNode = new AST.ASTNone();
            }
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

function shouldCaptureStoreInPattern(patternOps) {
    patternOps = patternOps || [];
    const expected = getExpectedPatternStoreCount(patternOps);
    if (expected == null) {
        return true;
    }
    const recorded = patternOps.filter(op => op.type === 'STORE_FAST').length;
    return recorded < expected;
}

function getExpectedPatternStoreCount(patternOps) {
    const matchClassOp = patternOps.find(op => op.type === 'MATCH_CLASS');
    if (matchClassOp) {
        if (matchClassOp.attrNames && matchClassOp.attrNames.length) {
            return matchClassOp.attrNames.length;
        }
        if (matchClassOp.count) {
            return matchClassOp.count;
        }
        return 0;
    }

    const unpackOp = patternOps.find(op => op.type === 'UNPACK_SEQUENCE');
    if (unpackOp) {
        return unpackOp.count;
    }

    return null;
}

function handleReserveFastA() {
    let list = [];
    this.code.Current.ConstantObject.Value.map(el => list[el.value] = el.key);
    this.dataStack.push(list);
}

function handleLoadFastAndClearA() {
    // Python 3.11+ LOAD_FAST_AND_CLEAR - loads local and clears it
    // Used in comprehensions to save/restore outer scope variables
    // For decompilation: just load the variable (clearing is implementation detail)
    handleLoadFastA.call(this);
}

function handleLoadFastBorrowA() {
    // Python 3.14+ LOAD_FAST_BORROW - optimized LOAD_FAST
    handleLoadFastA.call(this);
}

function handleLoadFastLoadFastA() {
    // Combined load of two fast locals: arg packs (hi<<8)|lo
    const idx1 = this.code.Current.Argument & 0xFF;
    const idx2 = (this.code.Current.Argument >> 8) & 0xFF;
    const varNames = this.object?.VarNames?.Value || this.object?.code?.object?.VarNames?.Value || [];
    const name1 = varNames[idx1]?.toString?.() || `##var_${idx1}##`;
    const name2 = varNames[idx2]?.toString?.() || `##var_${idx2}##`;
    this.dataStack.push(new AST.ASTName(name1));
    this.dataStack.push(new AST.ASTName(name2));
}

function handleStoreFastLoadFastA() {
    // Combined store then load: store to first index, load second
    const idx1 = this.code.Current.Argument & 0xFF;
    const idx2 = (this.code.Current.Argument >> 8) & 0xFF;
    const varNames = this.object?.VarNames?.Value || this.object?.code?.object?.VarNames?.Value || [];
    const name1 = varNames[idx1]?.toString?.() || `##var_${idx1}##`;
    const name2 = varNames[idx2]?.toString?.() || `##var_${idx2}##`;

    const valueNode = this.dataStack.pop() || new AST.ASTNone();
    const destNode = new AST.ASTName(name1);
    this.curBlock.append(new AST.ASTStore(valueNode, destNode));

    // Push second local load as result
    this.dataStack.push(new AST.ASTName(name2));
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
    handleDeleteDerefA,
    handleLoadAttrA,
    handleLoadConstA,
    handleLoadDerefA,
    handleLoadClassderefA,
    handleLoadFastA,
    handleLoadFastAndClearA,
    handleLoadFastBorrowA,
    handleLoadFastLoadFastA,
    handleLoadGlobalA,
    handleLoadLocals,
    handleLoadSmallIntA,
    handleStoreLocals,
    handleLoadMethodA,
    handleLoadNameA,
    handleStoreAttrA,
    handleStoreDerefA,
    handleStoreFastA,
    handleStoreFastLoadFastA,
    handleStoreGlobalA,
    handleStoreNameA,
    handleReserveFastA
};
