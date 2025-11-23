const AST = require('../ast/ast_node');

function handleBinarySubscr()
{
    let subscr = this.dataStack.pop();
    let src = this.dataStack.pop();
    let node = new AST.ASTSubscr(src, subscr);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleMapAddA() {
    handleBuildSliceA.call(this);
}

function handleStoreMap() {
    handleBuildSliceA.call(this);
}

function handleBuildSliceA() {
    if (this.code.Current.Argument == 2) {
        let end = this.dataStack.pop();
        let start = this.dataStack.pop();

        if (start instanceof AST.ASTObject && (start.object == null || start.object.ClassName == 'Py_None')) {
            start = null;
        }

        if (end instanceof AST.ASTObject && (end.object == null || end.object.ClassName == 'Py_None')) {
            end = null;
        }

        let sliceOp = null;
        if (!start && !end) {
            sliceOp = AST.ASTSlice.SliceOp.Slice0;
        } else if (!start) {
            sliceOp = AST.ASTSlice.SliceOp.Slice2;
        } else if (!end) {
            sliceOp = AST.ASTSlice.SliceOp.Slice1;
        } else {
            sliceOp = AST.ASTSlice.SliceOp.Slice3;
        }

        let mapNode = new AST.ASTSlice(sliceOp, start || new AST.ASTNone(), end || new AST.ASTNone());
        mapNode.line = this.code.Current.LineNo;
        this.dataStack.push(mapNode);
    } else if (this.code.Current.Argument == 3) {
        let step = this.dataStack.pop();
        let end = this.dataStack.pop();
        let start = this.dataStack.pop();

        if (start instanceof AST.ASTObject && (start.object == null || start.object.ClassName == 'Py_None')) {
            start = null;
        }

        if (end instanceof AST.ASTObject && (end.object == null || end.object.ClassName == 'Py_None')) {
            end = null;
        }

        if (step instanceof AST.ASTObject && (step.object == null || step.object.ClassName == 'Py_None')) {
            step = null;
        }

        let sliceOp = null;
        if (!start && !end) {
            sliceOp = AST.ASTSlice.SliceOp.Slice0;
        } else if (!start) {
            sliceOp = AST.ASTSlice.SliceOp.Slice2;
        } else if (!end) {
            sliceOp = AST.ASTSlice.SliceOp.Slice1;
        } else {
            sliceOp = AST.ASTSlice.SliceOp.Slice3;
        }

        let lhs = new AST.ASTSlice(sliceOp, start || new AST.ASTNone(), end || new AST.ASTNone());
        lhs.line = this.code.Current.LineNo;

        if (!step) {
            sliceOp = AST.ASTSlice.SliceOp.Slice1;
        } else {
            sliceOp = AST.ASTSlice.SliceOp.Slice3;
        }

        let sliceNode = new AST.ASTSlice(sliceOp, start || new AST.ASTNone(), end || new AST.ASTNone());
        sliceNode.line = this.code.Current.LineNo;
        this.dataStack.push(sliceNode);
    }
}

function handleDeleteSlice0() {
    if (this.code.Current?.InstructionName === 'NOT_TAKEN') {
        if (global.g_cliArgs?.debug) {
            console.log(`[NOT_TAKEN] skipping instrumentation hint at offset ${this.code.Current.Offset}`);
        }
        return;
    }
    let name = this.dataStack.pop();
    let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice0)));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteSlice1() {
    let upper = this.dataStack.pop();
    let name = this.dataStack.pop();

    let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, upper)));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteSlice2() {
    let lower = this.dataStack.pop();
    let name = this.dataStack.pop();

    let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, lower)));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteSlice3() {
    let lower = this.dataStack.pop();
    let upper = this.dataStack.pop();
    let name = this.dataStack.pop();

    let node = new AST.ASTDelete(new AST.ASTSubscr(name, new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, upper, lower)));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleDeleteSubscr() {
    let key = this.dataStack.pop();
    let name = this.dataStack.pop();

    let node = new AST.ASTDelete(new AST.ASTSubscr(name, key));
    node.line = this.code.Current.LineNo;
    this.curBlock.nodes.push(node);
}

function handleSlice0() {
    let name = this.dataStack.pop();
    if (name instanceof AST.ASTChainStore) {
        name = name.source;
    }

    let sliceNode = new AST.ASTSlice (AST.ASTSlice.SliceOp.Slice0);
    let node = new AST.ASTSubscr (name, sliceNode);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleSlice1() {
    let lower = this.dataStack.pop();
    let name = this.dataStack.pop();

    let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, lower);
    let node = new AST.ASTSubscr(name, sliceNode);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);
}

function handleSlice2() {
    let upper = this.dataStack.pop();
    let name = this.dataStack.pop();

    let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, null, upper);
    let node = new AST.ASTSubscr(name, sliceNode);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleSlice3() {
    let upper = this.dataStack.pop();
    let lower = this.dataStack.pop();
    let name = this.dataStack.pop();

    let sliceNode = new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, lower, upper);
    let node = new AST.ASTSubscr(name, sliceNode);
    node.line = this.code.Current.LineNo;
    this.dataStack.push(node);    
}

function handleStoreSlice0() {
    let destNode = this.dataStack.pop();
    let valueNode = this.dataStack.pop();
    let node = new AST.ASTStore(valueNode,
                    new AST.ASTSubscr(destNode,
                        new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice0)
                    )
                );
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

function handleStoreSlice1() {
    let upper = this.dataStack.pop();
    let dest = this.dataStack.pop();
    let value = this.dataStack.pop();
    let node = new AST.ASTStore(value,
        new AST.ASTSubscr(dest,
            new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice1, upper)
        )
    );
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

function handleStoreSlice2() {
    let lowerNode = this.dataStack.pop();
    let destNode = this.dataStack.pop();
    let valueNode = this.dataStack.pop();
    let node = new AST.ASTStore(valueNode,
        new AST.ASTSubscr(destNode,
            new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice2, null, lowerNode)));
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

function handleStoreSlice3() {
    let lowerNode = this.dataStack.pop();
    let upperNode = this.dataStack.pop();
    let destNode = this.dataStack.pop();
    let valueNode = this.dataStack.pop();
    let node = new AST.ASTStore(valueNode,
        new AST.ASTSubscr(destNode,
            new AST.ASTSlice(AST.ASTSlice.SliceOp.Slice3, upperNode, lowerNode)));
    node.line = this.code.Current.LineNo;
    this.curBlock.append(node);
}

function getAnnotationTargetName(node) {
    if (!node) {
        return null;
    }
    if (node instanceof AST.ASTName) {
        return node.name;
    }
    if (node instanceof AST.ASTObject) {
        let value = node.object?.Value;
        if (value !== undefined && value !== null) {
            return value.toString();
        }
    }
    let fragment = node.codeFragment?.();
    if (!fragment) {
        return null;
    }
    fragment = fragment.toString ? fragment.toString() : fragment;
    if (typeof fragment !== 'string') {
        return null;
    }
    const trimmed = fragment.trim();
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        return trimmed.substring(1, trimmed.length - 1);
    }
    return trimmed;
}

function storeMatchesAnnotation(storeNode, annotationKeyNode) {
    if (!(storeNode instanceof AST.ASTStore)) {
        return false;
    }
    const annotationName = getAnnotationTargetName(annotationKeyNode);
    if (!annotationName) {
        return false;
    }

    const dest = storeNode.dest;
    if (dest instanceof AST.ASTName) {
        return dest.name === annotationName;
    }
    return false;
}

function handleStoreSubscr() {
    if (this.unpack) {
        let subscrNode = this.dataStack.pop();
        let destNode = this.dataStack.pop();

        let saveNode = new AST.ASTSubscr(destNode, subscrNode);

        let tupleNode = this.dataStack.top();
        if (tupleNode instanceof AST.ASTTuple)
            tupleNode.add(saveNode);
        else if (global.g_cliArgs?.debug)
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
        let subscrNode = this.dataStack.pop();
        let destNode = this.dataStack.pop();
        let srcNode = this.dataStack.pop();

        // If variable annotations are enabled, we'll need to check for them here.
        // Python handles a varaible annotation by setting:
        // __annotations__['var-name'] = type
        let found_annotated_var = (this.variable_annotations && destNode instanceof AST.ASTName
            && destNode.name == "__annotations__");

        if (found_annotated_var) {
            // Annotations can be done alone or as part of an assignment.
            // In the case of an assignment, we'll see a NODE_STORE on the this.dataStack.
            if (!this.curBlock.nodes.empty()) {
                // Replace the existing NODE_STORE with a new one that includes the annotation.
                let store = this.curBlock.nodes.top();
                if (store instanceof AST.ASTStore && storeMatchesAnnotation(store, subscrNode)) {
                    this.curBlock.removeLast();
                    let node = new AST.ASTStore(store.src,
                        new AST.ASTAnnotatedVar(subscrNode, srcNode)
                    );
                    node.line = this.code.Current.LineNo;
                    this.curBlock.append(node);
                } else {
                    let node = new AST.ASTAnnotatedVar(subscrNode, srcNode);
                    node.line = this.code.Current.LineNo;
                    this.curBlock.append(node);
                }
            } else {
                let node = new AST.ASTAnnotatedVar(subscrNode, srcNode);
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        } else {
            if (destNode instanceof AST.ASTMap) {
                destNode.add(subscrNode, srcNode);
            } else if (srcNode instanceof AST.ASTChainStore) {
                this.append_to_chain_store(srcNode, new AST.ASTSubscr(destNode, subscrNode));
            } else {
                let node = new AST.ASTStore(srcNode,
                    new AST.ASTSubscr(destNode, subscrNode)
                );
                node.line = this.code.Current.LineNo;
                this.curBlock.append(node);
            }
        }
    }
}

module.exports = {
    handleBinarySubscr,
    handleMapAddA,
    handleStoreMap,
    handleBuildSliceA,
    handleDeleteSlice0,
    handleDeleteSlice1,
    handleDeleteSlice2,
    handleDeleteSlice3,
    handleDeleteSubscr,
    handleSlice0,
    handleSlice1,
    handleSlice2,
    handleSlice3,
    handleStoreSlice0,
    handleStoreSlice1,
    handleStoreSlice2,
    handleStoreSlice3,
    handleStoreSubscr,
};
