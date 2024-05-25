
function classSaver(key, value) {
    if (value && typeof(value) == "object") {
        value.___serialized__class_name = value.constructor.name;
        return value;
    }
    return value;
}

function restoreObjectPrototype(obj) {
    if (obj) {
        for (let subObject of Object.values(obj)) {
            if (subObject && typeof(subObject) == "object") {
                restoreObjectPrototype(subObject);
                if (subObject.___serialized__class_name) {
                    Object.setPrototypeOf(subObject, global[subObject.___serialized__class_name]);
                    delete subObject.___serialized__class_name;
                    subObject = subObject;
                }
            }
        }
    }    
}

class StackHistory {
    history = [];

    push(historyElement) {
        this.history.push(JSON.stringify(historyElement, classSaver));
    }

    top() {
        if (this.history.length == 0) {
            return [];
        }
        try {
            let value = JSON.parse(this.history[this.history.length - 1]);
            restoreObjectPrototype(value);
            return value;
        } catch (ex) {
            return [];
        }
    }

    pop() {
        let stack = this.top();
        this.history.pop();
        return stack;
    }
    get length() {
        return this.history.length;
    }

    set length(value) {
        this.history.length = value;
    }

    empty() {
        return this.history.length == 0;
    }
}

module.exports = StackHistory;