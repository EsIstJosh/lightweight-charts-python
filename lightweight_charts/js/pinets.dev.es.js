
/* 
 * Copyright (C) 2025 Alaa-eddine KADDOURI
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import * as astring from 'astring';

var __defProp$7 = Object.defineProperty;
var __defNormalProp$7 = (obj, key, value) => key in obj ? __defProp$7(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$7 = (obj, key, value) => __defNormalProp$7(obj, typeof key !== "symbol" ? key + "" : key, value);
class ScopeManager {
  constructor() {
    __publicField$7(this, "scopes", []);
    __publicField$7(this, "scopeTypes", []);
    __publicField$7(this, "scopeCounts", /* @__PURE__ */ new Map());
    __publicField$7(this, "contextBoundVars", /* @__PURE__ */ new Set());
    __publicField$7(this, "arrayPatternElements", /* @__PURE__ */ new Set());
    __publicField$7(this, "rootParams", /* @__PURE__ */ new Set());
    __publicField$7(this, "varKinds", /* @__PURE__ */ new Map());
    __publicField$7(this, "loopVars", /* @__PURE__ */ new Set());
    __publicField$7(this, "loopVarNames", /* @__PURE__ */ new Map());
    // Map original names to transformed names
    __publicField$7(this, "paramIdCounter", 0);
    __publicField$7(this, "cacheIdCounter", 0);
    __publicField$7(this, "tempVarCounter", 0);
    this.pushScope("glb");
  }
  get nextParamIdArg() {
    return {
      type: "Identifier",
      name: `'p${this.paramIdCounter++}'`
    };
  }
  get nextCacheIdArg() {
    return {
      type: "Identifier",
      name: `'cache_${this.cacheIdCounter++}'`
    };
  }
  pushScope(type) {
    this.scopes.push(/* @__PURE__ */ new Map());
    this.scopeTypes.push(type);
    this.scopeCounts.set(type, (this.scopeCounts.get(type) || 0) + 1);
  }
  popScope() {
    this.scopes.pop();
    this.scopeTypes.pop();
  }
  getCurrentScopeType() {
    return this.scopeTypes[this.scopeTypes.length - 1];
  }
  getCurrentScopeCount() {
    return this.scopeCounts.get(this.getCurrentScopeType()) || 1;
  }
  addContextBoundVar(name, isRootParam = false) {
    this.contextBoundVars.add(name);
    if (isRootParam) {
      this.rootParams.add(name);
    }
  }
  addArrayPatternElement(name) {
    this.arrayPatternElements.add(name);
  }
  isContextBound(name) {
    return this.contextBoundVars.has(name);
  }
  isArrayPatternElement(name) {
    return this.arrayPatternElements.has(name);
  }
  isRootParam(name) {
    return this.rootParams.has(name);
  }
  addLoopVariable(originalName, transformedName) {
    this.loopVars.add(originalName);
    this.loopVarNames.set(originalName, transformedName);
  }
  getLoopVariableName(name) {
    return this.loopVarNames.get(name);
  }
  isLoopVariable(name) {
    return this.loopVars.has(name);
  }
  addVariable(name, kind) {
    if (this.isContextBound(name)) {
      return name;
    }
    const currentScope = this.scopes[this.scopes.length - 1];
    const scopeType = this.scopeTypes[this.scopeTypes.length - 1];
    const scopeCount = this.scopeCounts.get(scopeType) || 1;
    const newName = `${scopeType}${scopeCount}_${name}`;
    currentScope.set(name, newName);
    this.varKinds.set(newName, kind);
    return newName;
  }
  getVariable(name) {
    if (this.loopVars.has(name)) {
      const transformedName = this.loopVarNames.get(name);
      if (transformedName) {
        return [transformedName, "let"];
      }
    }
    if (this.isContextBound(name)) {
      return [name, "let"];
    }
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i];
      if (scope.has(name)) {
        const scopedName = scope.get(name);
        const kind = this.varKinds.get(scopedName) || "let";
        return [scopedName, kind];
      }
    }
    return [name, "let"];
  }
  generateTempVar() {
    return `temp_${++this.tempVarCounter}`;
  }
}

//!!!Warning!!! this code is not clean, it was initially written as a PoC then used as transpiler for PineTS
const CONTEXT_NAME = "$";
const UNDEFINED_ARG = {
  type: "Identifier",
  name: "undefined"
};
function transformArrayIndex(node, scopeManager) {
  if (node.computed && node.property.type === "Identifier") {
    if (scopeManager.isLoopVariable(node.property.name)) {
      return;
    }
    if (!scopeManager.isContextBound(node.property.name)) {
      const [scopedName, kind] = scopeManager.getVariable(node.property.name);
      node.property = {
        type: "MemberExpression",
        object: {
          type: "MemberExpression",
          object: {
            type: "Identifier",
            name: CONTEXT_NAME
          },
          property: {
            type: "Identifier",
            name: kind
          },
          computed: false
        },
        property: {
          type: "Identifier",
          name: scopedName
        },
        computed: false
      };
      node.property = {
        type: "MemberExpression",
        object: node.property,
        property: {
          type: "Literal",
          value: 0
        },
        computed: true
      };
    }
  }
  if (node.computed && node.object.type === "Identifier") {
    if (scopeManager.isLoopVariable(node.object.name)) {
      return;
    }
    if (!scopeManager.isContextBound(node.object.name)) {
      const [scopedName, kind] = scopeManager.getVariable(node.object.name);
      node.object = {
        type: "MemberExpression",
        object: {
          type: "MemberExpression",
          object: {
            type: "Identifier",
            name: CONTEXT_NAME
          },
          property: {
            type: "Identifier",
            name: kind
          },
          computed: false
        },
        property: {
          type: "Identifier",
          name: scopedName
        },
        computed: false
      };
    }
    if (node.property.type === "MemberExpression") {
      const memberNode = node.property;
      if (!memberNode._indexTransformed) {
        transformArrayIndex(memberNode, scopeManager);
        memberNode._indexTransformed = true;
      }
    }
  }
}
function transformMemberExpression(memberNode, originalParamName, scopeManager) {
  if (memberNode.object && memberNode.object.type === "Identifier" && memberNode.object.name === "Math") {
    return;
  }
  const isIfStatement = scopeManager.getCurrentScopeType() == "if";
  const isElseStatement = scopeManager.getCurrentScopeType() == "els";
  const isForStatement = scopeManager.getCurrentScopeType() == "for";
  if (!isIfStatement && !isElseStatement && !isForStatement && memberNode.object && memberNode.object.type === "Identifier" && scopeManager.isContextBound(memberNode.object.name) && !scopeManager.isRootParam(memberNode.object.name)) {
    return;
  }
  if (!memberNode._indexTransformed) {
    transformArrayIndex(memberNode, scopeManager);
    memberNode._indexTransformed = true;
  }
}
function transformVariableDeclaration(varNode, scopeManager) {
  varNode.declarations.forEach((decl) => {
    if (decl.init.name == "na") {
      decl.init.name = "NaN";
    }
    const isContextProperty = decl.init && decl.init.type === "MemberExpression" && decl.init.object && (decl.init.object.name === "context" || decl.init.object.name === CONTEXT_NAME || decl.init.object.name === "context2");
    const isSubContextProperty = decl.init && decl.init.type === "MemberExpression" && decl.init.object?.object && (decl.init.object.object.name === "context" || decl.init.object.object.name === CONTEXT_NAME || decl.init.object.object.name === "context2");
    const isArrowFunction = decl.init && decl.init.type === "ArrowFunctionExpression";
    if (isContextProperty) {
      if (decl.id.name) {
        scopeManager.addContextBoundVar(decl.id.name);
      }
      if (decl.id.properties) {
        decl.id.properties.forEach((property) => {
          if (property.key.name) {
            scopeManager.addContextBoundVar(property.key.name);
          }
        });
      }
      decl.init.object.name = CONTEXT_NAME;
      return;
    }
    if (isSubContextProperty) {
      if (decl.id.name) {
        scopeManager.addContextBoundVar(decl.id.name);
      }
      if (decl.id.properties) {
        decl.id.properties.forEach((property) => {
          if (property.key.name) {
            scopeManager.addContextBoundVar(property.key.name);
          }
        });
      }
      decl.init.object.object.name = CONTEXT_NAME;
      return;
    }
    if (isArrowFunction) {
      decl.init.params.forEach((param) => {
        if (param.type === "Identifier") {
          scopeManager.addContextBoundVar(param.name);
        }
      });
    }
    const newName = scopeManager.addVariable(decl.id.name, varNode.kind);
    const kind = varNode.kind;
    if (decl.init && !isArrowFunction) {
      if (decl.init.type === "CallExpression" && decl.init.callee.type === "MemberExpression" && decl.init.callee.object && decl.init.callee.object.type === "Identifier" && scopeManager.isContextBound(decl.init.callee.object.name)) {
        transformCallExpression(decl.init, scopeManager);
      } else {
        walk.recursive(
          decl.init,
          { parent: decl.init },
          {
            Identifier(node, state) {
              node.parent = state.parent;
              transformIdentifier(node, scopeManager);
              const isBinaryOperation = node.parent && node.parent.type === "BinaryExpression";
              const isConditional = node.parent && node.parent.type === "ConditionalExpression";
              if (node.type === "Identifier" && (isBinaryOperation || isConditional)) {
                Object.assign(node, {
                  type: "MemberExpression",
                  object: {
                    type: "Identifier",
                    name: node.name
                  },
                  property: {
                    type: "Literal",
                    value: 0
                  },
                  computed: true
                });
              }
            },
            CallExpression(node, state, c) {
              if (node.callee.type === "Identifier") {
                node.callee.parent = node;
              }
              node.arguments.forEach((arg) => {
                if (arg.type === "Identifier") {
                  arg.parent = node;
                }
              });
              transformCallExpression(node, scopeManager);
              node.arguments.forEach((arg) => c(arg, { parent: node }));
            },
            BinaryExpression(node, state, c) {
              if (node.left.type === "Identifier") {
                node.left.parent = node;
              }
              if (node.right.type === "Identifier") {
                node.right.parent = node;
              }
              c(node.left, { parent: node });
              c(node.right, { parent: node });
            },
            MemberExpression(node, state, c) {
              if (node.object.type === "Identifier") {
                node.object.parent = node;
              }
              if (node.property.type === "Identifier") {
                node.property.parent = node;
              }
              transformArrayIndex(node, scopeManager);
              if (node.object) {
                c(node.object, { parent: node });
              }
            }
          }
        );
      }
    }
    const targetVarRef = {
      type: "MemberExpression",
      object: {
        type: "MemberExpression",
        object: {
          type: "Identifier",
          name: CONTEXT_NAME
        },
        property: {
          type: "Identifier",
          name: kind
        },
        computed: false
      },
      property: {
        type: "Identifier",
        name: newName
      },
      computed: false
    };
    const isArrayPatternVar = scopeManager.isArrayPatternElement(decl.id.name);
    const isArrayInit = !isArrayPatternVar && decl.init && decl.init.type === "MemberExpression" && decl.init.computed && decl.init.property && (decl.init.property.type === "Literal" || decl.init.property.type === "MemberExpression");
    if (decl.init?.property?.type === "MemberExpression") {
      if (!decl.init.property._indexTransformed) {
        transformArrayIndex(decl.init.property, scopeManager);
        decl.init.property._indexTransformed = true;
      }
    }
    const assignmentExpr = {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: targetVarRef,
        right: decl.init ? isArrowFunction || isArrayPatternVar ? decl.init : {
          type: "CallExpression",
          callee: {
            type: "MemberExpression",
            object: {
              type: "Identifier",
              name: CONTEXT_NAME
            },
            property: {
              type: "Identifier",
              name: "init"
            },
            computed: false
          },
          arguments: isArrayInit ? [targetVarRef, decl.init.object, decl.init.property] : [targetVarRef, decl.init]
        } : {
          type: "Identifier",
          name: "undefined"
        }
      }
    };
    if (isArrayPatternVar) {
      assignmentExpr.expression.right.object.property.name += `?.[0][${decl.init.property.value}]`;
      const obj = assignmentExpr.expression.right.object;
      assignmentExpr.expression.right = {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: {
            type: "Identifier",
            name: CONTEXT_NAME
          },
          property: {
            type: "Identifier",
            name: "init"
          },
          computed: false
        },
        arguments: [
          targetVarRef,
          obj
          /*, decl.init.property.value*/
        ]
      };
    }
    if (isArrowFunction) {
      scopeManager.pushScope("fn");
      walk.recursive(decl.init.body, scopeManager, {
        BlockStatement(node, state, c) {
          node.body.forEach((stmt) => c(stmt, state));
        },
        IfStatement(node, state, c) {
          state.pushScope("if");
          c(node.consequent, state);
          if (node.alternate) {
            state.pushScope("els");
            c(node.alternate, state);
            state.popScope();
          }
          state.popScope();
        },
        VariableDeclaration(node, state) {
          transformVariableDeclaration(node, state);
        },
        Identifier(node, state) {
          transformIdentifier(node, state);
        },
        AssignmentExpression(node, state) {
          transformAssignmentExpression(node, state);
        }
      });
      scopeManager.popScope();
    }
    Object.assign(varNode, assignmentExpr);
  });
}
function transformIdentifier(node, scopeManager) {
  if (node.name !== CONTEXT_NAME) {
    if (node.name === "Math" || node.name === "NaN" || node.name === "undefined" || node.name === "Infinity" || node.name === "null" || node.name.startsWith("'") && node.name.endsWith("'") || node.name.startsWith('"') && node.name.endsWith('"') || node.name.startsWith("`") && node.name.endsWith("`")) {
      return;
    }
    if (scopeManager.isLoopVariable(node.name)) {
      return;
    }
    if (scopeManager.isContextBound(node.name) && !scopeManager.isRootParam(node.name)) {
      return;
    }
    const isNamespaceMember = node.parent && node.parent.type === "MemberExpression" && node.parent.object === node && scopeManager.isContextBound(node.name);
    const isParamCall = node.parent && node.parent.type === "CallExpression" && node.parent.callee && node.parent.callee.type === "MemberExpression" && node.parent.callee.property.name === "param";
    node.parent && node.parent.type === "AssignmentExpression" && node.parent.left === node;
    const isNamespaceFunctionArg = node.parent && node.parent.type === "CallExpression" && node.parent.callee && node.parent.callee.type === "MemberExpression" && scopeManager.isContextBound(node.parent.callee.object.name);
    const isArrayAccess = node.parent && node.parent.type === "MemberExpression" && node.parent.computed;
    const isArrayIndexInNamespaceCall = node.parent && node.parent.type === "MemberExpression" && node.parent.computed && node.parent.property === node && node.parent.parent && node.parent.parent.type === "CallExpression" && node.parent.parent.callee && node.parent.parent.callee.type === "MemberExpression" && scopeManager.isContextBound(node.parent.parent.callee.object.name);
    const isFunctionCall = node.parent && node.parent.type === "CallExpression" && node.parent.callee === node;
    if (isNamespaceMember || isParamCall || isNamespaceFunctionArg || isArrayIndexInNamespaceCall || isFunctionCall) {
      if (isFunctionCall) {
        return;
      }
      const [scopedName2, kind2] = scopeManager.getVariable(node.name);
      Object.assign(node, {
        type: "MemberExpression",
        object: {
          type: "MemberExpression",
          object: {
            type: "Identifier",
            name: CONTEXT_NAME
          },
          property: {
            type: "Identifier",
            name: kind2
          },
          computed: false
        },
        property: {
          type: "Identifier",
          name: scopedName2
        },
        computed: false
      });
      return;
    }
    const [scopedName, kind] = scopeManager.getVariable(node.name);
    const memberExpr = {
      type: "MemberExpression",
      object: {
        type: "MemberExpression",
        object: {
          type: "Identifier",
          name: CONTEXT_NAME
        },
        property: {
          type: "Identifier",
          name: kind
        },
        computed: false
      },
      property: {
        type: "Identifier",
        name: scopedName
      },
      computed: false
    };
    const hasArrayAccess = node.parent && node.parent.type === "MemberExpression" && node.parent.computed && node.parent.object === node;
    if (!hasArrayAccess && !isArrayAccess) {
      Object.assign(node, {
        type: "MemberExpression",
        object: memberExpr,
        property: {
          type: "Literal",
          value: 0
        },
        computed: true
      });
    } else {
      Object.assign(node, memberExpr);
    }
  }
}
function transformAssignmentExpression(node, scopeManager) {
  if (node.left.type === "Identifier") {
    const [varName, kind] = scopeManager.getVariable(node.left.name);
    const memberExpr = {
      type: "MemberExpression",
      object: {
        type: "MemberExpression",
        object: {
          type: "Identifier",
          name: CONTEXT_NAME
        },
        property: {
          type: "Identifier",
          name: kind
        },
        computed: false
      },
      property: {
        type: "Identifier",
        name: varName
      },
      computed: false
    };
    node.left = {
      type: "MemberExpression",
      object: memberExpr,
      property: {
        type: "Literal",
        value: 0
      },
      computed: true
    };
  }
  walk.recursive(
    node.right,
    { parent: node.right, inNamespaceCall: false },
    {
      Identifier(node2, state, c) {
        if (node2.name == "na") {
          node2.name = "NaN";
        }
        node2.parent = state.parent;
        transformIdentifier(node2, scopeManager);
        const isBinaryOperation = node2.parent && node2.parent.type === "BinaryExpression";
        const isConditional = node2.parent && node2.parent.type === "ConditionalExpression";
        const isContextBound = scopeManager.isContextBound(node2.name) && !scopeManager.isRootParam(node2.name);
        const hasArrayAccess = node2.parent && node2.parent.type === "MemberExpression" && node2.parent.computed && node2.parent.object === node2;
        const isParamCall = node2.parent && node2.parent._isParamCall;
        const isMemberExpression = node2.parent && node2.parent.type === "MemberExpression";
        const isReserved = node2.name === "NaN";
        if (isContextBound || isConditional || isBinaryOperation) {
          if (node2.type === "MemberExpression") {
            transformArrayIndex(node2, scopeManager);
          } else if (node2.type === "Identifier" && !isMemberExpression && !hasArrayAccess && !isParamCall && !isReserved) {
            addArrayAccess(node2);
          }
        }
      },
      MemberExpression(node2, state, c) {
        transformArrayIndex(node2, scopeManager);
        if (node2.object) {
          c(node2.object, { parent: node2, inNamespaceCall: state.inNamespaceCall });
        }
      },
      CallExpression(node2, state, c) {
        const isNamespaceCall = node2.callee && node2.callee.type === "MemberExpression" && node2.callee.object && node2.callee.object.type === "Identifier" && scopeManager.isContextBound(node2.callee.object.name);
        transformCallExpression(node2, scopeManager);
        node2.arguments.forEach((arg) => c(arg, { parent: node2, inNamespaceCall: isNamespaceCall || state.inNamespaceCall }));
      }
    }
  );
}
function transformArrowFunctionParams(node, scopeManager, isRootFunction = false) {
  node.params.forEach((param) => {
    if (param.type === "Identifier") {
      scopeManager.addContextBoundVar(param.name, isRootFunction);
    }
  });
}
function transformReturnStatement(node, scopeManager) {
  const curScope = scopeManager.getCurrentScopeType();
  if (node.argument) {
    if (node.argument.type === "ArrayExpression") {
      node.argument.elements = node.argument.elements.map((element) => {
        if (element.type === "Identifier") {
          if (scopeManager.isContextBound(element.name) && !scopeManager.isRootParam(element.name)) {
            return {
              type: "MemberExpression",
              object: element,
              property: {
                type: "Literal",
                value: 0
              },
              computed: true
            };
          }
          const [scopedName, kind] = scopeManager.getVariable(element.name);
          return {
            type: "MemberExpression",
            object: {
              type: "MemberExpression",
              object: {
                type: "MemberExpression",
                object: {
                  type: "Identifier",
                  name: CONTEXT_NAME
                },
                property: {
                  type: "Identifier",
                  name: kind
                },
                computed: false
              },
              property: {
                type: "Identifier",
                name: scopedName
              },
              computed: false
            },
            property: {
              type: "Literal",
              value: 0
            },
            computed: true
          };
        } else if (element.type === "MemberExpression") {
          if (element.computed && element.object.type === "Identifier" && scopeManager.isContextBound(element.object.name) && !scopeManager.isRootParam(element.object.name)) {
            return element;
          }
          transformMemberExpression(element, "", scopeManager);
          return element;
        }
        return element;
      });
      node.argument = {
        type: "ArrayExpression",
        elements: [node.argument]
      };
    } else if (node.argument.type === "BinaryExpression") {
      walk.recursive(node.argument, scopeManager, {
        Identifier(node2, state) {
          transformIdentifier(node2, state);
          if (node2.type === "Identifier") {
            addArrayAccess(node2);
          }
        },
        MemberExpression(node2) {
          transformMemberExpression(node2, "", scopeManager);
        }
      });
    } else if (node.argument.type === "ObjectExpression") {
      node.argument.properties = node.argument.properties.map((prop) => {
        if (prop.shorthand) {
          const [scopedName, kind] = scopeManager.getVariable(prop.value.name);
          return {
            type: "Property",
            key: {
              type: "Identifier",
              name: prop.key.name
            },
            value: {
              type: "MemberExpression",
              object: {
                type: "MemberExpression",
                object: {
                  type: "Identifier",
                  name: CONTEXT_NAME
                },
                property: {
                  type: "Identifier",
                  name: kind
                },
                computed: false
              },
              property: {
                type: "Identifier",
                name: scopedName
              },
              computed: false
            },
            kind: "init",
            method: false,
            shorthand: false,
            computed: false
          };
        }
        return prop;
      });
    } else if (node.argument.type === "Identifier") {
      const [scopedName, kind] = scopeManager.getVariable(node.argument.name);
      node.argument = {
        type: "MemberExpression",
        object: {
          type: "MemberExpression",
          object: {
            type: "Identifier",
            name: CONTEXT_NAME
          },
          property: {
            type: "Identifier",
            name: kind
          },
          computed: false
        },
        property: {
          type: "Identifier",
          name: scopedName
        },
        computed: false
      };
      node.argument = {
        type: "MemberExpression",
        object: node.argument,
        property: {
          type: "Literal",
          value: 0
        },
        computed: true
      };
    }
    if (curScope === "fn") {
      node.argument = {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: { type: "Identifier", name: CONTEXT_NAME },
          property: { type: "Identifier", name: "precision" }
        },
        arguments: [node.argument]
      };
    }
  }
}
function transformIdentifierForParam(node, scopeManager) {
  if (node.type === "Identifier") {
    if (node.name === "na") {
      node.name = "NaN";
      return node;
    }
    if (scopeManager.isLoopVariable(node.name)) {
      return node;
    }
    if (scopeManager.isRootParam(node.name)) {
      const [scopedName2, kind2] = scopeManager.getVariable(node.name);
      return {
        type: "MemberExpression",
        object: {
          type: "MemberExpression",
          object: {
            type: "Identifier",
            name: CONTEXT_NAME
          },
          property: {
            type: "Identifier",
            name: kind2
          },
          computed: false
        },
        property: {
          type: "Identifier",
          name: scopedName2
        },
        computed: false
      };
    }
    if (scopeManager.isContextBound(node.name)) {
      return node;
    }
    const [scopedName, kind] = scopeManager.getVariable(node.name);
    return {
      type: "MemberExpression",
      object: {
        type: "MemberExpression",
        object: {
          type: "Identifier",
          name: CONTEXT_NAME
        },
        property: {
          type: "Identifier",
          name: kind
        },
        computed: false
      },
      property: {
        type: "Identifier",
        name: scopedName
      },
      computed: false
    };
  }
  return node;
}
function getParamFromUnaryExpression(node, scopeManager, namespace) {
  const transformedArgument = transformOperand(node.argument, scopeManager, namespace);
  const unaryExpr = {
    type: "UnaryExpression",
    operator: node.operator,
    prefix: node.prefix,
    argument: transformedArgument,
    start: node.start,
    end: node.end
  };
  return unaryExpr;
}
function transformOperand(node, scopeManager, namespace = "") {
  switch (node.type) {
    case "BinaryExpression": {
      return getParamFromBinaryExpression(node, scopeManager, namespace);
    }
    case "MemberExpression": {
      const transformedObject = node.object.type === "Identifier" ? transformIdentifierForParam(node.object, scopeManager) : node.object;
      return {
        type: "MemberExpression",
        object: transformedObject,
        property: node.property,
        computed: node.computed
      };
    }
    case "Identifier": {
      if (scopeManager.isLoopVariable(node.name)) {
        return node;
      }
      const isMemberExprProperty = node.parent && node.parent.type === "MemberExpression" && node.parent.property === node;
      if (isMemberExprProperty) {
        return node;
      }
      const transformedObject = transformIdentifierForParam(node, scopeManager);
      return {
        type: "MemberExpression",
        object: transformedObject,
        property: {
          type: "Literal",
          value: 0
        },
        computed: true
      };
    }
    case "UnaryExpression": {
      return getParamFromUnaryExpression(node, scopeManager, namespace);
    }
  }
  return node;
}
function getParamFromBinaryExpression(node, scopeManager, namespace) {
  const transformedLeft = transformOperand(node.left, scopeManager, namespace);
  const transformedRight = transformOperand(node.right, scopeManager, namespace);
  const binaryExpr = {
    type: "BinaryExpression",
    operator: node.operator,
    left: transformedLeft,
    right: transformedRight,
    start: node.start,
    end: node.end
  };
  walk.recursive(binaryExpr, scopeManager, {
    CallExpression(node2, scopeManager2) {
      if (!node2._transformed) {
        transformCallExpression(node2, scopeManager2);
      }
    },
    MemberExpression(node2) {
      transformMemberExpression(node2, "", scopeManager);
    }
  });
  return binaryExpr;
}
function getParamFromLogicalExpression(node, scopeManager, namespace) {
  const transformedLeft = transformOperand(node.left, scopeManager, namespace);
  const transformedRight = transformOperand(node.right, scopeManager, namespace);
  const logicalExpr = {
    type: "LogicalExpression",
    operator: node.operator,
    left: transformedLeft,
    right: transformedRight,
    start: node.start,
    end: node.end
  };
  walk.recursive(logicalExpr, scopeManager, {
    CallExpression(node2, scopeManager2) {
      if (!node2._transformed) {
        transformCallExpression(node2, scopeManager2);
      }
    }
  });
  return logicalExpr;
}
function getParamFromConditionalExpression(node, scopeManager, namespace) {
  walk.recursive(
    node,
    { parent: node, inNamespaceCall: false },
    {
      Identifier(node2, state, c) {
        if (node2.name == "NaN") return;
        if (node2.name == "na") {
          node2.name = "NaN";
          return;
        }
        node2.parent = state.parent;
        transformIdentifier(node2, scopeManager);
        const isBinaryOperation = node2.parent && node2.parent.type === "BinaryExpression";
        const isConditional = node2.parent && node2.parent.type === "ConditionalExpression";
        if (isConditional || isBinaryOperation) {
          if (node2.type === "MemberExpression") {
            transformArrayIndex(node2, scopeManager);
          } else if (node2.type === "Identifier") {
            addArrayAccess(node2);
          }
        }
      },
      MemberExpression(node2, state, c) {
        transformArrayIndex(node2, scopeManager);
        if (node2.object) {
          c(node2.object, { parent: node2, inNamespaceCall: state.inNamespaceCall });
        }
      },
      CallExpression(node2, state, c) {
        const isNamespaceCall = node2.callee && node2.callee.type === "MemberExpression" && node2.callee.object && node2.callee.object.type === "Identifier" && scopeManager.isContextBound(node2.callee.object.name);
        transformCallExpression(node2, scopeManager);
        node2.arguments.forEach((arg) => c(arg, { parent: node2, inNamespaceCall: isNamespaceCall || state.inNamespaceCall }));
      }
    }
  );
  return {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: { type: "Identifier", name: namespace },
      property: { type: "Identifier", name: "param" }
    },
    arguments: [node, UNDEFINED_ARG, scopeManager.nextParamIdArg],
    _transformed: true,
    _isParamCall: true
  };
}
function transformFunctionArgument(arg, namespace, scopeManager) {
  switch (arg?.type) {
    case "BinaryExpression":
      arg = getParamFromBinaryExpression(arg, scopeManager, namespace);
      break;
    case "LogicalExpression":
      arg = getParamFromLogicalExpression(arg, scopeManager, namespace);
      break;
    case "ConditionalExpression":
      return getParamFromConditionalExpression(arg, scopeManager, namespace);
    case "UnaryExpression":
      arg = getParamFromUnaryExpression(arg, scopeManager, namespace);
      break;
  }
  const isArrayAccess = arg.type === "MemberExpression" && arg.computed && arg.property;
  if (isArrayAccess) {
    const transformedObject = arg.object.type === "Identifier" && scopeManager.isContextBound(arg.object.name) && !scopeManager.isRootParam(arg.object.name) ? arg.object : transformIdentifierForParam(arg.object, scopeManager);
    const transformedProperty = arg.property.type === "Identifier" && !scopeManager.isContextBound(arg.property.name) && !scopeManager.isLoopVariable(arg.property.name) ? transformIdentifierForParam(arg.property, scopeManager) : arg.property;
    return {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: {
          type: "Identifier",
          name: namespace
        },
        property: {
          type: "Identifier",
          name: "param"
        },
        computed: false
      },
      arguments: [transformedObject, transformedProperty, scopeManager.nextParamIdArg],
      _transformed: true,
      _isParamCall: true
    };
  }
  if (arg.type === "ObjectExpression") {
    arg.properties = arg.properties.map((prop) => {
      if (prop.value.name) {
        const [scopedName, kind] = scopeManager.getVariable(prop.value.name);
        return {
          type: "Property",
          key: {
            type: "Identifier",
            name: prop.key.name
          },
          value: {
            type: "MemberExpression",
            object: {
              type: "MemberExpression",
              object: {
                type: "Identifier",
                name: CONTEXT_NAME
              },
              property: {
                type: "Identifier",
                name: kind
              },
              computed: false
            },
            property: {
              type: "Identifier",
              name: scopedName
            },
            computed: false
          },
          kind: "init",
          method: false,
          shorthand: false,
          computed: false
        };
      }
      return prop;
    });
  }
  if (arg.type === "Identifier") {
    if (arg.name === "na") {
      arg.name = "NaN";
      return arg;
    }
    if (scopeManager.isContextBound(arg.name) && !scopeManager.isRootParam(arg.name)) {
      return {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: {
            type: "Identifier",
            name: namespace
          },
          property: {
            type: "Identifier",
            name: "param"
          },
          computed: false
        },
        arguments: [arg, UNDEFINED_ARG, scopeManager.nextParamIdArg],
        _transformed: true,
        _isParamCall: true
      };
    }
  }
  if (arg?.type === "CallExpression") {
    transformCallExpression(arg, scopeManager);
  }
  return {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: {
        type: "Identifier",
        name: namespace
      },
      property: {
        type: "Identifier",
        name: "param"
      },
      computed: false
    },
    arguments: [arg.type === "Identifier" ? transformIdentifierForParam(arg, scopeManager) : arg, UNDEFINED_ARG, scopeManager.nextParamIdArg],
    _transformed: true,
    _isParamCall: true
  };
}
function transformCallExpression(node, scopeManager, namespace) {
  if (node._transformed) {
    return;
  }
  const isNamespaceCall = node.callee && node.callee.type === "MemberExpression" && node.callee.object && node.callee.object.type === "Identifier" && (scopeManager.isContextBound(node.callee.object.name) || node.callee.object.name === "math" || node.callee.object.name === "ta");
  if (isNamespaceCall) {
    const namespace2 = node.callee.object.name;
    node.arguments = node.arguments.map((arg) => {
      if (arg._isParamCall) {
        return arg;
      }
      return transformFunctionArgument(arg, namespace2, scopeManager);
    });
    node._transformed = true;
  } else if (node.callee && node.callee.type === "Identifier") {
    node.arguments = node.arguments.map((arg) => {
      if (arg._isParamCall) {
        return arg;
      }
      return transformFunctionArgument(arg, CONTEXT_NAME, scopeManager);
    });
    node._transformed = true;
  }
  node.arguments.forEach((arg) => {
    walk.recursive(arg, scopeManager, {
      Identifier(node2, state, c) {
        node2.parent = state.parent;
        transformIdentifier(node2, scopeManager);
        const isBinaryOperation = node2.parent && node2.parent.type === "BinaryExpression";
        const isConditional = node2.parent && node2.parent.type === "ConditionalExpression";
        if (isConditional || isBinaryOperation) {
          if (node2.type === "MemberExpression") {
            transformArrayIndex(node2, scopeManager);
          } else if (node2.type === "Identifier") {
            addArrayAccess(node2);
          }
        }
      },
      CallExpression(node2, state, c) {
        if (!node2._transformed) {
          transformCallExpression(node2, state);
        }
      },
      MemberExpression(node2, state, c) {
        transformMemberExpression(node2, "", scopeManager);
        if (node2.object) {
          c(node2.object, { parent: node2, inNamespaceCall: state.inNamespaceCall });
        }
      }
    });
  });
}
function transformFunctionDeclaration(node, scopeManager) {
  node.params.forEach((param) => {
    if (param.type === "Identifier") {
      scopeManager.addContextBoundVar(param.name, false);
    }
  });
  if (node.body && node.body.type === "BlockStatement") {
    scopeManager.pushScope("fn");
    walk.recursive(node.body, scopeManager, {
      BlockStatement(node2, state, c) {
        node2.body.forEach((stmt) => c(stmt, state));
      },
      ReturnStatement(node2, state) {
        transformReturnStatement(node2, state);
      },
      VariableDeclaration(node2, state) {
        transformVariableDeclaration(node2, state);
      },
      Identifier(node2, state) {
        transformIdentifier(node2, state);
      },
      CallExpression(node2, state) {
        transformCallExpression(node2, state);
        node2.arguments.forEach((arg) => {
          if (arg.type === "BinaryExpression") {
            walk.recursive(arg, state, {
              CallExpression(node3, state2) {
                transformCallExpression(node3, state2);
              },
              MemberExpression(node3) {
                transformMemberExpression(node3, "", state);
              }
            });
          }
        });
      },
      MemberExpression(node2) {
        transformMemberExpression(node2, "", scopeManager);
      },
      AssignmentExpression(node2, state) {
        transformAssignmentExpression(node2, state);
      },
      ForStatement(node2, state, c) {
        transformForStatement(node2, state, c);
      },
      IfStatement(node2, state, c) {
        transformIfStatement(node2, state, c);
      },
      BinaryExpression(node2, state, c) {
        walk.recursive(node2, state, {
          CallExpression(node3, state2) {
            transformCallExpression(node3, state2);
          },
          MemberExpression(node3) {
            transformMemberExpression(node3, "", state);
          }
        });
      }
    });
    scopeManager.popScope();
  }
}
function addArrayAccess(node, scopeManager) {
  Object.assign(node, {
    type: "MemberExpression",
    object: {
      type: "Identifier",
      name: node.name,
      start: node.start,
      end: node.end
    },
    property: {
      type: "Literal",
      value: 0
    },
    computed: true,
    _indexTransformed: true
  });
}
function transformForStatement(node, scopeManager, c) {
  if (node.init && node.init.type === "VariableDeclaration") {
    const decl = node.init.declarations[0];
    const originalName = decl.id.name;
    scopeManager.addLoopVariable(originalName, originalName);
    node.init = {
      type: "VariableDeclaration",
      kind: node.init.kind,
      declarations: [
        {
          type: "VariableDeclarator",
          id: {
            type: "Identifier",
            name: originalName
          },
          init: decl.init
        }
      ]
    };
    if (decl.init) {
      walk.recursive(decl.init, scopeManager, {
        Identifier(node2, state) {
          if (!scopeManager.isLoopVariable(node2.name)) {
            scopeManager.pushScope("for");
            transformIdentifier(node2, state);
            scopeManager.popScope();
          }
        },
        MemberExpression(node2) {
          scopeManager.pushScope("for");
          transformMemberExpression(node2, "", scopeManager);
          scopeManager.popScope();
        }
      });
    }
  }
  if (node.test) {
    walk.recursive(node.test, scopeManager, {
      Identifier(node2, state) {
        if (!scopeManager.isLoopVariable(node2.name) && !node2.computed) {
          scopeManager.pushScope("for");
          transformIdentifier(node2, state);
          if (node2.type === "Identifier") {
            node2.computed = true;
            addArrayAccess(node2);
          }
          scopeManager.popScope();
        }
      },
      MemberExpression(node2) {
        scopeManager.pushScope("for");
        transformMemberExpression(node2, "", scopeManager);
        scopeManager.popScope();
      }
    });
  }
  if (node.update) {
    walk.recursive(node.update, scopeManager, {
      Identifier(node2, state) {
        if (!scopeManager.isLoopVariable(node2.name)) {
          scopeManager.pushScope("for");
          transformIdentifier(node2, state);
          scopeManager.popScope();
        }
      }
    });
  }
  scopeManager.pushScope("for");
  c(node.body, scopeManager);
  scopeManager.popScope();
}
function transformExpression(node, scopeManager) {
  walk.recursive(node, scopeManager, {
    MemberExpression(node2) {
      transformMemberExpression(node2, "", scopeManager);
    },
    CallExpression(node2, state) {
      transformCallExpression(node2, state);
    },
    Identifier(node2, state) {
      transformIdentifier(node2, state);
      const isIfStatement = scopeManager.getCurrentScopeType() === "if";
      const isContextBound = scopeManager.isContextBound(node2.name) && !scopeManager.isRootParam(node2.name);
      if (isContextBound && isIfStatement) {
        addArrayAccess(node2);
      }
    }
  });
}
function transformIfStatement(node, scopeManager, c) {
  if (node.test) {
    scopeManager.pushScope("if");
    transformExpression(node.test, scopeManager);
    scopeManager.popScope();
  }
  scopeManager.pushScope("if");
  c(node.consequent, scopeManager);
  scopeManager.popScope();
  if (node.alternate) {
    scopeManager.pushScope("els");
    c(node.alternate, scopeManager);
    scopeManager.popScope();
  }
}
function transformNestedArrowFunctions(ast) {
  walk.recursive(ast, null, {
    VariableDeclaration(node, state, c) {
      if (node.declarations && node.declarations.length > 0) {
        const declarations = node.declarations;
        declarations.forEach((decl) => {
          if (decl.init && decl.init.type === "ArrowFunctionExpression") {
            const isRootFunction = decl.init.start === 0;
            if (!isRootFunction) {
              const functionDeclaration = {
                type: "FunctionDeclaration",
                id: decl.id,
                // Use the variable name as function name
                params: decl.init.params,
                body: decl.init.body.type === "BlockStatement" ? decl.init.body : {
                  type: "BlockStatement",
                  body: [
                    {
                      type: "ReturnStatement",
                      argument: decl.init.body
                    }
                  ]
                },
                async: decl.init.async,
                generator: false
              };
              Object.assign(node, functionDeclaration);
            }
          }
        });
      }
      if (node.body && node.body.body) {
        node.body.body.forEach((stmt) => c(stmt, state));
      }
    }
  });
}
function preProcessContextBoundVars(ast, scopeManager) {
  walk.simple(ast, {
    VariableDeclaration(node) {
      node.declarations.forEach((decl) => {
        const isContextProperty = decl.init && decl.init.type === "MemberExpression" && decl.init.object && (decl.init.object.name === "context" || decl.init.object.name === CONTEXT_NAME || decl.init.object.name === "context2");
        const isSubContextProperty = decl.init && decl.init.type === "MemberExpression" && decl.init.object?.object && (decl.init.object.object.name === "context" || decl.init.object.object.name === CONTEXT_NAME || decl.init.object.object.name === "context2");
        if (isContextProperty || isSubContextProperty) {
          if (decl.id.name) {
            scopeManager.addContextBoundVar(decl.id.name);
          }
          if (decl.id.properties) {
            decl.id.properties.forEach((property) => {
              if (property.key.name) {
                scopeManager.addContextBoundVar(property.key.name);
              }
            });
          }
        }
      });
    }
  });
}
function transpile(fn) {
  let code = typeof fn === "function" ? fn.toString() : fn;
  const ast = acorn.parse(code.trim(), {
    ecmaVersion: "latest",
    sourceType: "module"
  });
  transformNestedArrowFunctions(ast);
  const scopeManager = new ScopeManager();
  let originalParamName;
  preProcessContextBoundVars(ast, scopeManager);
  walk.simple(ast, {
    FunctionDeclaration(node) {
      transformFunctionDeclaration(node, scopeManager);
    },
    ArrowFunctionExpression(node) {
      const isRootFunction = node.start === 0;
      if (isRootFunction && node.params && node.params.length > 0) {
        originalParamName = node.params[0].name;
        node.params[0].name = CONTEXT_NAME;
      }
      transformArrowFunctionParams(node, scopeManager, isRootFunction);
    },
    VariableDeclaration(node) {
      node.declarations.forEach((decl) => {
        if (decl.id.type === "ArrayPattern") {
          const tempVarName = scopeManager.generateTempVar();
          const tempVarDecl = {
            type: "VariableDeclaration",
            kind: node.kind,
            declarations: [
              {
                type: "VariableDeclarator",
                id: {
                  type: "Identifier",
                  name: tempVarName
                },
                init: decl.init
              }
            ]
          };
          decl.id.elements?.forEach((element) => {
            if (element.type === "Identifier") {
              scopeManager.addArrayPatternElement(element.name);
            }
          });
          const individualDecls = decl.id.elements.map((element, index) => ({
            type: "VariableDeclaration",
            kind: node.kind,
            declarations: [
              {
                type: "VariableDeclarator",
                id: element,
                init: {
                  type: "MemberExpression",
                  object: {
                    type: "Identifier",
                    name: tempVarName
                  },
                  property: {
                    type: "Literal",
                    value: index
                  },
                  computed: true
                }
              }
            ]
          }));
          Object.assign(node, {
            type: "BlockStatement",
            body: [tempVarDecl, ...individualDecls]
          });
        }
      });
    },
    ForStatement(node) {
    }
  });
  walk.recursive(ast, scopeManager, {
    BlockStatement(node, state, c) {
      node.body.forEach((stmt) => c(stmt, state));
    },
    ReturnStatement(node, state) {
      transformReturnStatement(node, state);
    },
    VariableDeclaration(node, state) {
      transformVariableDeclaration(node, state);
    },
    Identifier(node, state) {
      transformIdentifier(node, state);
    },
    CallExpression(node, state) {
      transformCallExpression(node, state);
    },
    MemberExpression(node) {
      transformMemberExpression(node, originalParamName, scopeManager);
    },
    AssignmentExpression(node, state) {
      transformAssignmentExpression(node, state);
    },
    FunctionDeclaration(node, state) {
      return;
    },
    ForStatement(node, state, c) {
      transformForStatement(node, state, c);
    },
    IfStatement(node, state, c) {
      transformIfStatement(node, state, c);
    }
  });
  const transformedCode = astring.generate(ast);
  const _wraperFunction = new Function("", `return ${transformedCode}`);
  return _wraperFunction(this);
}

var __defProp$6 = Object.defineProperty;
var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$6 = (obj, key, value) => __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
class PineTS {
  constructor(source, tickerId, timeframe, limit, sDate, eDate) {
    this.source = source;
    this.tickerId = tickerId;
    this.timeframe = timeframe;
    this.limit = limit;
    this.sDate = sDate;
    this.eDate = eDate;
    __publicField$6(this, "data", []);
    //#region [Pine Script built-in variables]
    __publicField$6(this, "open", []);
    __publicField$6(this, "high", []);
    __publicField$6(this, "low", []);
    __publicField$6(this, "close", []);
    __publicField$6(this, "volume", []);
    __publicField$6(this, "hl2", []);
    __publicField$6(this, "hlc3", []);
    __publicField$6(this, "ohlc4", []);
    __publicField$6(this, "openTime", []);
    __publicField$6(this, "closeTime", []);
    //#endregion
    //#region run context
    __publicField$6(this, "_periods");
    //#endregion
    //public fn: Function;
    __publicField$6(this, "_readyPromise", null);
    __publicField$6(this, "_ready", false);
    this._readyPromise = new Promise((resolve) => {
      this.loadMarketData(source, tickerId, timeframe, limit, sDate, eDate).then((data) => {
        const marketData = data.reverse();
        this._periods = marketData.length;
        this.data = marketData;
        const _open = marketData.map((d) => d.open);
        const _close = marketData.map((d) => d.close);
        const _high = marketData.map((d) => d.high);
        const _low = marketData.map((d) => d.low);
        const _volume = marketData.map((d) => d.volume);
        const _hlc3 = marketData.map((d) => (d.high + d.low + d.close) / 3);
        const _hl2 = marketData.map((d) => (d.high + d.low) / 2);
        const _ohlc4 = marketData.map((d) => (d.high + d.low + d.open + d.close) / 4);
        const _openTime = marketData.map((d) => d.openTime);
        const _closeTime = marketData.map((d) => d.closeTime);
        this.open = _open;
        this.close = _close;
        this.high = _high;
        this.low = _low;
        this.volume = _volume;
        this.hl2 = _hl2;
        this.hlc3 = _hlc3;
        this.ohlc4 = _ohlc4;
        this.openTime = _openTime;
        this.closeTime = _closeTime;
        this._ready = true;
        resolve(true);
      });
    });
  }
  get periods() {
    return this._periods;
  }
  async loadMarketData(source, tickerId, timeframe, limit, sDate, eDate) {
    if (Array.isArray(source)) {
      return source;
    } else {
      return source.getMarketData(tickerId, timeframe, limit, sDate, eDate);
    }
  }
  async ready() {
    if (this._ready) return true;
    if (!this._readyPromise) throw new Error("PineTS is not ready");
    return this._readyPromise;
  }
  async run(pineTSCode, n, useTACache) {
    await this.ready();
    if (!n) n = this._periods;
    const context = new Context({
      marketData: this.data,
      source: this.source,
      tickerId: this.tickerId,
      timeframe: this.timeframe,
      limit: this.limit,
      sDate: this.sDate,
      eDate: this.eDate
    });
    context.pineTSCode = pineTSCode;
    context.useTACache = useTACache;
    const transformer = transpile.bind(this);
    let transpiledFn = transformer(pineTSCode);
    const contextVarNames = ["const", "var", "let", "params"];
    for (let i = this._periods - n, idx = n - 1; i < this._periods; i++, idx--) {
      context.idx = i;
      context.data.close = this.close.slice(idx);
      context.data.open = this.open.slice(idx);
      context.data.high = this.high.slice(idx);
      context.data.low = this.low.slice(idx);
      context.data.volume = this.volume.slice(idx);
      context.data.hl2 = this.hl2.slice(idx);
      context.data.hlc3 = this.hlc3.slice(idx);
      context.data.ohlc4 = this.ohlc4.slice(idx);
      context.data.openTime = this.openTime.slice(idx);
      context.data.closeTime = this.closeTime.slice(idx);
      const result = await transpiledFn(context);
      if (typeof result === "object") {
        if (typeof context.result !== "object") {
          context.result = {};
        }
        for (let key in result) {
          if (context.result[key] === void 0) {
            context.result[key] = [];
          }
          const val = Array.isArray(result[key]) ? result[key][0] : result[key];
          context.result[key].push(val);
        }
      } else {
        if (!Array.isArray(context.result)) {
          context.result = [];
        }
        context.result.push(result);
      }
      for (let ctxVarName of contextVarNames) {
        for (let key in context[ctxVarName]) {
          if (Array.isArray(context[ctxVarName][key])) {
            const val = context[ctxVarName][key][0];
            context[ctxVarName][key].unshift(val);
          }
        }
      }
    }
    return context;
  }
}

var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$5 = (obj, key, value) => __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
class Core {
  constructor(context) {
    this.context = context;
    __publicField$5(this, "color", {
      param: (source, index = 0) => {
        if (Array.isArray(source)) {
          return source[index];
        }
        return source;
      },
      rgb: (r, g, b, a) => a ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`,
      new: (color, a) => {
        if (color && color.startsWith("#")) {
          const hex = color.slice(1);
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          return a ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
        }
        return a ? `rgba(${color}, ${a})` : color;
      },
      white: "white",
      lime: "lime",
      green: "green",
      red: "red",
      maroon: "maroon",
      black: "black",
      gray: "gray",
      blue: "blue"
    });
  }
  extractPlotOptions(options) {
    const _options = {};
    for (let key in options) {
      if (Array.isArray(options[key])) {
        _options[key] = options[key][0];
      } else {
        _options[key] = options[key];
      }
    }
    return _options;
  }
  indicator(title, shorttitle, options) {
  }
  //in the current implementation, plot functions are only used to collect data for the plots array and map it to the market data
  plotchar(series, title, options) {
    if (!this.context.plots[title]) {
      this.context.plots[title] = { data: [], options: this.extractPlotOptions(options), title };
    }
    this.context.plots[title].data.push({
      time: this.context.marketData[this.context.marketData.length - this.context.idx - 1].openTime,
      value: series[0],
      options: { ...this.extractPlotOptions(options), style: "char" }
    });
  }
  plot(series, title, options) {
    if (!this.context.plots[title]) {
      this.context.plots[title] = { data: [], options: this.extractPlotOptions(options), title };
    }
    this.context.plots[title].data.push({
      time: this.context.marketData[this.context.marketData.length - this.context.idx - 1].openTime,
      value: series[0],
      options: this.extractPlotOptions(options)
    });
  }
  na(series) {
    return Array.isArray(series) ? isNaN(series[0]) : isNaN(series);
  }
  nz(series, replacement = 0) {
    const val = Array.isArray(series) ? series[0] : series;
    const rep = Array.isArray(series) ? replacement[0] : replacement;
    return isNaN(val) ? rep : val;
  }
}

class Input {
  constructor(context) {
    this.context = context;
  }
  param(source, index = 0) {
    if (Array.isArray(source)) {
      return [source[index]];
    }
    return [source];
  }
  any(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  int(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  float(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  bool(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  string(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  timeframe(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  time(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  price(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  session(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  source(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  symbol(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  text_area(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  enum(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
  color(value, { title, group } = {}) {
    return Array.isArray(value) ? value[0] : value;
  }
}

var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
class PineMath {
  constructor(context) {
    this.context = context;
    __publicField$4(this, "_cache", {});
  }
  param(source, index, name) {
    if (!this.context.params[name]) this.context.params[name] = [];
    if (Array.isArray(source)) {
      if (index) {
        this.context.params[name] = source.slice(index);
        this.context.params[name].length = source.length;
        return this.context.params[name];
      }
      this.context.params[name] = source.slice(0);
      return this.context.params[name];
    } else {
      this.context.params[name][0] = source;
      return this.context.params[name];
    }
  }
  abs(source) {
    return Math.abs(source[0]);
  }
  pow(source, power) {
    return Math.pow(source[0], power[0]);
  }
  sqrt(source) {
    return Math.sqrt(source[0]);
  }
  log(source) {
    return Math.log(source[0]);
  }
  ln(source) {
    return Math.log(source[0]);
  }
  exp(source) {
    return Math.exp(source[0]);
  }
  floor(source) {
    return Math.floor(source[0]);
  }
  ceil(source) {
    return Math.ceil(source[0]);
  }
  round(source) {
    return Math.round(source[0]);
  }
  random() {
    return Math.random();
  }
  max(...source) {
    const arg = source.map((e) => Array.isArray(e) ? e[0] : e);
    return Math.max(...arg);
  }
  min(...source) {
    const arg = source.map((e) => Array.isArray(e) ? e[0] : e);
    return Math.min(...arg);
  }
  //sum of last n values
  sum(source, length) {
    const len = Array.isArray(length) ? length[0] : length;
    if (Array.isArray(source)) {
      return source.slice(0, len).reduce((a, b) => a + b, 0);
    }
    return source;
  }
  sin(source) {
    return Math.sin(source[0]);
  }
  cos(source) {
    return Math.cos(source[0]);
  }
  tan(source) {
    return Math.tan(source[0]);
  }
  acos(source) {
    return Math.acos(source[0]);
  }
  asin(source) {
    return Math.asin(source[0]);
  }
  atan(source) {
    return Math.atan(source[0]);
  }
  avg(...sources) {
    const args = sources.map((e) => Array.isArray(e) ? e[0] : e);
    return args.reduce((a, b) => {
      const aVal = Array.isArray(a) ? a[0] : a;
      const bVal = Array.isArray(b) ? b[0] : b;
      return aVal + bVal;
    }, 0) / args.length;
  }
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
const TIMEFRAMES = ["1", "3", "5", "15", "30", "45", "60", "120", "180", "240", "D", "W", "M"];
class PineRequest {
  constructor(context) {
    this.context = context;
    __publicField$3(this, "_cache", {});
  }
  param(source, index, name) {
    if (!this.context.params[name]) this.context.params[name] = [];
    if (Array.isArray(source)) {
      if (index) {
        this.context.params[name] = source.slice(index);
      } else {
        this.context.params[name] = source.slice(0);
      }
      return [source[index], name];
    } else {
      this.context.params[name][0] = source;
      return [source, name];
    }
  }
  async security(symbol, timeframe, expression, gaps = false, lookahead = false, ignore_invalid_symbol = false, currency = null, calc_bars_count = null) {
    const _symbol = symbol[0];
    const _timeframe = timeframe[0];
    const _expression = expression[0];
    const _expression_name = expression[1];
    const ctxTimeframeIdx = TIMEFRAMES.indexOf(this.context.timeframe);
    const reqTimeframeIdx = TIMEFRAMES.indexOf(_timeframe);
    if (ctxTimeframeIdx == -1 || reqTimeframeIdx == -1) {
      throw new Error("Invalid timeframe");
    }
    if (ctxTimeframeIdx > reqTimeframeIdx) {
      throw new Error("Only higher timeframes are supported for now");
    }
    if (ctxTimeframeIdx === reqTimeframeIdx) {
      return _expression;
    }
    const myOpenTime = this.context.data.openTime[0];
    const myCloseTime = this.context.data.closeTime[0];
    if (this.context.cache[_expression_name]) {
      const secContext2 = this.context.cache[_expression_name];
      const secContextIdx2 = this._findSecContextIdx(myOpenTime, myCloseTime, secContext2.data.openTime, secContext2.data.closeTime, lookahead);
      return secContextIdx2 == -1 ? NaN : secContext2.params[_expression_name][secContextIdx2];
    }
    const pineTS = new PineTS(this.context.source, _symbol, _timeframe, this.context.limit || 1e3, this.context.sDate, this.context.eDate);
    const secContext = await pineTS.run(this.context.pineTSCode);
    this.context.cache[_expression_name] = secContext;
    const secContextIdx = this._findSecContextIdx(myOpenTime, myCloseTime, secContext.data.openTime, secContext.data.closeTime, lookahead);
    return secContextIdx == -1 ? NaN : secContext.params[_expression_name][secContextIdx];
  }
  _findSecContextIdx(myOpenTime, myCloseTime, openTime, closeTime, lookahead = false) {
    for (let i = 0; i < openTime.length; i++) {
      if (openTime[i] <= myOpenTime && myCloseTime <= closeTime[i]) {
        return i + (lookahead ? 1 : 2);
      }
    }
    return -1;
  }
}

class TechnicalAnalysis {
  constructor(context) {
    this.context = context;
  }
  get tr() {
    const val = this.context.math.max(
      this.context.data.high[0] - this.context.data.low[0],
      this.context.math.abs(this.context.data.high[0] - this.context.data.close[1]),
      this.context.math.abs(this.context.data.low[0] - this.context.data.close[1])
    );
    return val;
  }
  param(source, index, name) {
    if (!this.context.params[name]) this.context.params[name] = [];
    if (Array.isArray(source)) {
      if (index) {
        this.context.params[name] = source.slice(index);
        this.context.params[name].length = source.length;
        return this.context.params[name];
      }
      this.context.params[name] = source.slice(0);
      return this.context.params[name];
    } else {
      this.context.params[name][0] = source;
      return this.context.params[name];
    }
  }
  ema(source, _period) {
    const period = Array.isArray(_period) ? _period[0] : _period;
    const result = ema(source.slice(0).reverse(), period);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  sma(source, _period, _cacheId) {
    const period = Array.isArray(_period) ? _period[0] : _period;
    const reversedSource = source.slice(0).reverse();
    if (this.context.useTACache && _cacheId) {
      if (!this.context.cache[_cacheId]) {
        this.context.cache[_cacheId] = {};
      }
      const cacheObj = this.context.cache[_cacheId];
      if (cacheObj) {
        const result2 = sma_cache(reversedSource, period, cacheObj);
        const idx2 = this.context.idx;
        return this.context.precision(result2[idx2]);
      }
    }
    const result = sma(reversedSource, period);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  vwma(source, _period) {
    const period = Array.isArray(_period) ? _period[0] : _period;
    const volume = this.context.data.volume;
    const result = vwma(source.slice(0).reverse(), volume.slice(0).reverse(), period);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  wma(source, _period) {
    const period = Array.isArray(_period) ? _period[0] : _period;
    const result = wma(source.slice(0).reverse(), period);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  hma(source, _period) {
    const period = Array.isArray(_period) ? _period[0] : _period;
    const result = hma(source.slice(0).reverse(), period);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  rma(source, _period) {
    const period = Array.isArray(_period) ? _period[0] : _period;
    const result = rma(source.slice(0).reverse(), period);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  change(source, _length = 1) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const result = change(source.slice(0).reverse(), length);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  rsi(source, _period) {
    const period = Array.isArray(_period) ? _period[0] : _period;
    const result = rsi(source.slice(0).reverse(), period);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  atr(_period) {
    const period = Array.isArray(_period) ? _period[0] : _period;
    const high = this.context.data.high.slice().reverse();
    const low = this.context.data.low.slice().reverse();
    const close = this.context.data.close.slice().reverse();
    const result = atr(high, low, close, period);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  mom(source, _length) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const result = mom(source.slice(0).reverse(), length);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  roc(source, _length) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const result = roc(source.slice(0).reverse(), length);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  dev(source, _length) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const result = dev(source.slice(0).reverse(), length);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  variance(source, _length) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const result = variance(source.slice(0).reverse(), length);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  highest(source, _length) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const result = highest(source.slice(0).reverse(), length);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  lowest(source, _length) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const result = lowest(source.slice(0).reverse(), length);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  median(source, _length) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const result = median(source.slice(0).reverse(), length);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  stdev(source, _length, _bias = true) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const bias = Array.isArray(_bias) ? _bias[0] : _bias;
    const result = stdev(source.slice(0).reverse(), length, bias);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  linreg(source, _length, _offset) {
    const length = Array.isArray(_length) ? _length[0] : _length;
    const offset = Array.isArray(_offset) ? _offset[0] : _offset;
    const result = linreg(source.slice(0).reverse(), length, offset);
    const idx = this.context.idx;
    return this.context.precision(result[idx]);
  }
  supertrend(_factor, _atrPeriod) {
    const factor = Array.isArray(_factor) ? _factor[0] : _factor;
    const atrPeriod = Array.isArray(_atrPeriod) ? _atrPeriod[0] : _atrPeriod;
    const high = this.context.data.high.slice().reverse();
    const low = this.context.data.low.slice().reverse();
    const close = this.context.data.close.slice().reverse();
    const [supertrend, direction] = calculateSupertrend(high, low, close, factor, atrPeriod);
    const idx = this.context.idx;
    return [[this.context.precision(supertrend[idx]), direction[idx]]];
  }
}
function atr(high, low, close, period) {
  const tr = new Array(high.length);
  tr[0] = high[0] - low[0];
  for (let i = 1; i < high.length; i++) {
    const hl = high[i] - low[i];
    const hc = Math.abs(high[i] - close[i - 1]);
    const lc = Math.abs(low[i] - close[i - 1]);
    tr[i] = Math.max(hl, hc, lc);
  }
  const atr2 = new Array(high.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  atr2[period - 1] = sum / period;
  for (let i = period; i < tr.length; i++) {
    atr2[i] = (atr2[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr2;
}
function ema(source, period) {
  const result = new Array(source.length).fill(NaN);
  const alpha = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += source[i] || 0;
  }
  result[period - 1] = sum / period;
  for (let i = period; i < source.length; i++) {
    result[i] = source[i] * alpha + result[i - 1] * (1 - alpha);
  }
  return result;
}
function rsi(source, period) {
  const result = new Array(source.length).fill(NaN);
  const gains = new Array(source.length).fill(0);
  const losses = new Array(source.length).fill(0);
  for (let i = 1; i < source.length; i++) {
    const diff = source[i] - source[i - 1];
    gains[i] = diff > 0 ? diff : 0;
    losses[i] = diff < 0 ? -diff : 0;
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < source.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}
function rma(source, period) {
  const result = new Array(source.length).fill(NaN);
  const alpha = 1 / period;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += source[i] || 0;
  }
  result[period - 1] = sum / period;
  for (let i = period; i < source.length; i++) {
    const currentValue = source[i] || 0;
    result[i] = currentValue * alpha + result[i - 1] * (1 - alpha);
  }
  return result;
}
function sma_cache(source, period, cacheObj) {
  const result = cacheObj.previousResult || new Array(source.length).fill(NaN);
  const lastProcessedIndex = cacheObj.lastProcessedIndex || -1;
  let previousSum = cacheObj.previousSum || 0;
  if (lastProcessedIndex === -1 || source.length !== lastProcessedIndex + 1) {
    previousSum = 0;
    for (let i = 0; i < period; i++) {
      previousSum += source[i] || 0;
    }
    result[period - 1] = previousSum / period;
    for (let i = 0; i < period - 1; i++) {
      result[i] = NaN;
    }
    for (let i = period; i < source.length; i++) {
      previousSum = previousSum - (source[i - period] || 0) + (source[i] || 0);
      result[i] = previousSum / period;
    }
  } else if (source.length === lastProcessedIndex + 2) {
    const newIndex = source.length - 1;
    previousSum = previousSum - (source[newIndex - period] || 0) + (source[newIndex] || 0);
    result[newIndex] = previousSum / period;
  } else {
    return sma(source, period);
  }
  cacheObj.previousSum = previousSum;
  cacheObj.lastProcessedIndex = source.length - 1;
  cacheObj.previousResult = result;
  return result;
}
function sma(source, period) {
  const result = new Array(source.length).fill(NaN);
  for (let i = period - 1; i < source.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += source[i - j] || 0;
    }
    result[i] = sum / period;
  }
  return result;
}
function vwma(source, volume, period) {
  const result = new Array(source.length).fill(NaN);
  for (let i = period - 1; i < source.length; i++) {
    let sumVol = 0;
    let sumVolPrice = 0;
    for (let j = 0; j < period; j++) {
      sumVol += volume[i - j];
      sumVolPrice += source[i - j] * volume[i - j];
    }
    result[i] = sumVolPrice / sumVol;
  }
  return result;
}
function hma(source, period) {
  const halfPeriod = Math.floor(period / 2);
  const wma1 = wma(source, halfPeriod);
  const wma2 = wma(source, period);
  const rawHma = wma1.map((value, index) => 2 * value - wma2[index]);
  const sqrtPeriod = Math.floor(Math.sqrt(period));
  const result = wma(rawHma, sqrtPeriod);
  return result;
}
function wma(source, period) {
  const result = new Array(source.length);
  for (let i = period - 1; i < source.length; i++) {
    let numerator = 0;
    let denominator = 0;
    for (let j = 0; j < period; j++) {
      numerator += source[i - j] * (period - j);
      denominator += period - j;
    }
    result[i] = numerator / denominator;
  }
  for (let i = 0; i < period - 1; i++) {
    result[i] = NaN;
  }
  return result;
}
function change(source, length = 1) {
  const result = new Array(source.length).fill(NaN);
  for (let i = length; i < source.length; i++) {
    result[i] = source[i] - source[i - length];
  }
  return result;
}
function mom(source, length) {
  const result = new Array(source.length).fill(NaN);
  for (let i = length; i < source.length; i++) {
    result[i] = source[i] - source[i - length];
  }
  return result;
}
function roc(source, length) {
  const result = new Array(source.length).fill(NaN);
  for (let i = length; i < source.length; i++) {
    result[i] = (source[i] - source[i - length]) / source[i - length] * 100;
  }
  return result;
}
function dev(source, length) {
  const result = new Array(source.length).fill(NaN);
  const smaValues = sma(source, length);
  for (let i = length - 1; i < source.length; i++) {
    let sumDeviation = 0;
    for (let j = 0; j < length; j++) {
      sumDeviation += Math.abs(source[i - j] - smaValues[i]);
    }
    result[i] = sumDeviation / length;
  }
  return result;
}
function variance(source, length) {
  const result = new Array(source.length).fill(NaN);
  for (let i = length - 1; i < source.length; i++) {
    let sum = 0;
    let sumSquares = 0;
    for (let j = 0; j < length; j++) {
      sum += source[i - j];
      sumSquares += source[i - j] * source[i - j];
    }
    const mean = sum / length;
    result[i] = sumSquares / length - mean * mean;
  }
  return result;
}
function highest(source, length) {
  const result = new Array(source.length).fill(NaN);
  for (let i = length - 1; i < source.length; i++) {
    let max = -Infinity;
    for (let j = 0; j < length; j++) {
      const value = source[i - j];
      if (isNaN(value)) {
        max = max === -Infinity ? NaN : max;
      } else {
        max = Math.max(max, value);
      }
    }
    result[i] = max;
  }
  return result;
}
function lowest(source, length) {
  const result = new Array(source.length).fill(NaN);
  for (let i = length - 1; i < source.length; i++) {
    let min = Infinity;
    for (let j = 0; j < length; j++) {
      const value = source[i - j];
      if (isNaN(value) || value === void 0) {
        min = min === Infinity ? NaN : min;
      } else {
        min = Math.min(min, value);
      }
    }
    result[i] = min;
  }
  return result;
}
function median(source, length) {
  const result = new Array(source.length).fill(NaN);
  for (let i = length - 1; i < source.length; i++) {
    const window = source.slice(i - length + 1, i + 1);
    const sorted = window.slice().sort((a, b) => a - b);
    const mid = Math.floor(length / 2);
    result[i] = length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
  return result;
}
function stdev(source, length, biased = true) {
  const result = new Array(source.length).fill(NaN);
  const smaValues = sma(source, length);
  for (let i = length - 1; i < source.length; i++) {
    let sum = 0;
    for (let j = 0; j < length; j++) {
      sum += Math.pow(source[i - j] - smaValues[i], 2);
    }
    const divisor = biased ? length : length - 1;
    result[i] = Math.sqrt(sum / divisor);
  }
  return result;
}
function linreg(source, length, offset) {
  const size = source.length;
  const output = new Array(size).fill(NaN);
  for (let i = length - 1; i < size; i++) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const n = length;
    for (let j = 0; j < length; j++) {
      const x = j;
      const y = source[i - length + 1 + j];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) {
      output[i] = NaN;
      continue;
    }
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    const linRegValue = intercept + slope * (length - 1 - offset);
    output[i] = linRegValue;
  }
  return output;
}
function calculateSupertrend(high, low, close, factor, atrPeriod) {
  const length = high.length;
  const supertrend = new Array(length).fill(NaN);
  const direction = new Array(length).fill(0);
  const atrValues = atr(high, low, close, atrPeriod);
  const upperBand = new Array(length).fill(NaN);
  const lowerBand = new Array(length).fill(NaN);
  for (let i = 0; i < length; i++) {
    const hl2 = (high[i] + low[i]) / 2;
    const atrValue = atrValues[i];
    if (!isNaN(atrValue)) {
      upperBand[i] = hl2 + factor * atrValue;
      lowerBand[i] = hl2 - factor * atrValue;
    }
  }
  let prevUpperBand = upperBand[atrPeriod];
  let prevLowerBand = lowerBand[atrPeriod];
  let prevSupertrend = close[atrPeriod] <= prevUpperBand ? prevUpperBand : prevLowerBand;
  let prevDirection = close[atrPeriod] <= prevUpperBand ? -1 : 1;
  supertrend[atrPeriod] = prevSupertrend;
  direction[atrPeriod] = prevDirection;
  for (let i = atrPeriod + 1; i < length; i++) {
    let currentUpperBand = upperBand[i];
    if (currentUpperBand < prevUpperBand || close[i - 1] > prevUpperBand) {
      upperBand[i] = currentUpperBand;
    } else {
      upperBand[i] = prevUpperBand;
    }
    let currentLowerBand = lowerBand[i];
    if (currentLowerBand > prevLowerBand || close[i - 1] < prevLowerBand) {
      lowerBand[i] = currentLowerBand;
    } else {
      lowerBand[i] = prevLowerBand;
    }
    if (prevSupertrend === prevUpperBand) {
      if (close[i] > upperBand[i]) {
        direction[i] = 1;
        supertrend[i] = lowerBand[i];
      } else {
        direction[i] = -1;
        supertrend[i] = upperBand[i];
      }
    } else {
      if (close[i] < lowerBand[i]) {
        direction[i] = -1;
        supertrend[i] = upperBand[i];
      } else {
        direction[i] = 1;
        supertrend[i] = lowerBand[i];
      }
    }
    prevUpperBand = upperBand[i];
    prevLowerBand = lowerBand[i];
    prevSupertrend = supertrend[i];
  }
  return [supertrend, direction];
}

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
class PineArrayObject {
  constructor(array) {
    this.array = array;
  }
}
class PineArray {
  constructor(context) {
    this.context = context;
    __publicField$2(this, "_cache", {});
  }
  param(source, index = 0) {
    if (Array.isArray(source)) {
      return source[index];
    }
    return source;
  }
  /**
   * This function simulates PineScript's array.get() function
   * @param id - the array object to get the value from
   * @param index - the index of the value to get
   * @returns the value at the given index
   */
  get(id, index) {
    return id.array[index];
  }
  set(id, index, value) {
    id.array[index] = value;
  }
  push(id, value) {
    id.array.push(value);
  }
  // Basic statistics
  sum(id) {
    return id.array.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
  }
  avg(id) {
    return this.sum(id) / id.array.length;
  }
  min(id, nth = 0) {
    const sorted = [...id.array].sort((a, b) => a - b);
    return sorted[nth] ?? this.context.NA;
  }
  max(id, nth = 0) {
    const sorted = [...id.array].sort((a, b) => b - a);
    return sorted[nth] ?? this.context.NA;
  }
  size(id) {
    return id.array.length;
  }
  // Array creation
  new_bool(size, initial_value = false) {
    return new PineArrayObject(Array(size).fill(initial_value));
  }
  new_float(size, initial_value = NaN) {
    return new PineArrayObject(Array(size).fill(initial_value));
  }
  new_int(size, initial_value = 0) {
    return new PineArrayObject(Array(size).fill(Math.round(initial_value)));
  }
  new_string(size, initial_value = "") {
    return new PineArrayObject(Array(size).fill(initial_value));
  }
  new(size, initial_value) {
    return new PineArrayObject(Array(size).fill(initial_value));
  }
  // Array operations
  slice(id, start, end) {
    const adjustedEnd = end !== void 0 ? end + 1 : void 0;
    return new PineArrayObject(id.array.slice(start, adjustedEnd));
  }
  reverse(id) {
    id.array.reverse();
  }
  includes(id, value) {
    return id.array.includes(value);
  }
  indexof(id, value) {
    return id.array.indexOf(value);
  }
  lastindexof(id, value) {
    return id.array.lastIndexOf(value);
  }
  // More complex functions
  stdev(id, biased = true) {
    const mean = this.avg(id);
    const deviations = id.array.map((x) => Math.pow(x - mean, 2));
    const divisor = biased ? id.array.length : id.array.length - 1;
    return Math.sqrt(this.sum(new PineArrayObject(deviations)) / divisor);
  }
  variance(id, biased = true) {
    const mean = this.avg(id);
    const deviations = id.array.map((x) => Math.pow(x - mean, 2));
    const divisor = biased ? id.array.length : id.array.length - 1;
    return this.sum(new PineArrayObject(deviations)) / divisor;
  }
  covariance(arr1, arr2, biased = true) {
    if (arr1.array.length !== arr2.array.length || arr1.array.length < 2) return NaN;
    const divisor = biased ? arr1.array.length : arr1.array.length - 1;
    const mean1 = this.avg(arr1);
    const mean2 = this.avg(arr2);
    let sum = 0;
    for (let i = 0; i < arr1.array.length; i++) {
      sum += (arr1.array[i] - mean1) * (arr2.array[i] - mean2);
    }
    return sum / divisor;
  }
  // Additional utility methods
  first(id) {
    return id.array.length > 0 ? id.array[0] : this.context.NA;
  }
  last(id) {
    return id.array.length > 0 ? id.array[id.array.length - 1] : this.context.NA;
  }
  clear(id) {
    id.array.length = 0;
  }
  join(id, separator = ",") {
    return id.array.join(separator);
  }
  /** Array Manipulation Functions */
  abs(id) {
    return new PineArrayObject(id.array.map((val) => Math.abs(val)));
  }
  concat(id, other) {
    id.array.push(...other.array);
    return id;
  }
  copy(id) {
    return new PineArrayObject([...id.array]);
  }
  every(id, callback) {
    return id.array.every(callback);
  }
  fill(id, value, start = 0, end) {
    const length = id.array.length;
    const adjustedEnd = end !== void 0 ? Math.min(end, length) : length;
    for (let i = start; i < adjustedEnd; i++) {
      id.array[i] = value;
    }
  }
  from(source) {
    return new PineArrayObject([...source]);
  }
  insert(id, index, value) {
    id.array.splice(index, 0, value);
  }
  pop(id) {
    return id.array.pop();
  }
  range(id) {
    return this.max(id) - this.min(id);
  }
  remove(id, index) {
    if (index >= 0 && index < id.array.length) {
      return id.array.splice(index, 1)[0];
    }
    return this.context.NA;
  }
  shift(id) {
    return id.array.shift();
  }
  sort(id, order = "asc") {
    id.array.sort((a, b) => order === "asc" ? a - b : b - a);
  }
  sort_indices(id, comparator) {
    const indices = id.array.map((_, index) => index);
    indices.sort((a, b) => {
      const valA = id.array[a];
      const valB = id.array[b];
      return comparator ? comparator(valA, valB) : valA - valB;
    });
    return new PineArrayObject(indices);
  }
  standardize(id) {
    const mean = this.avg(id);
    const stdev = this.stdev(id);
    if (stdev === 0) {
      return new PineArrayObject(id.array.map(() => 0));
    }
    return new PineArrayObject(id.array.map((x) => (x - mean) / stdev));
  }
  unshift(id, value) {
    id.array.unshift(value);
  }
  some(id, callback) {
    return id.array.some(callback);
  }
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
class Context {
  constructor({
    marketData,
    source,
    tickerId,
    timeframe,
    limit,
    sDate,
    eDate
  }) {
    __publicField$1(this, "data", {
      open: [],
      high: [],
      low: [],
      close: [],
      volume: [],
      hl2: [],
      hlc3: [],
      ohlc4: []
    });
    __publicField$1(this, "cache", {});
    __publicField$1(this, "useTACache", false);
    __publicField$1(this, "NA", NaN);
    __publicField$1(this, "math");
    __publicField$1(this, "ta");
    __publicField$1(this, "input");
    __publicField$1(this, "request");
    __publicField$1(this, "array");
    __publicField$1(this, "core");
    __publicField$1(this, "lang");
    __publicField$1(this, "idx", 0);
    __publicField$1(this, "params", {});
    __publicField$1(this, "const", {});
    __publicField$1(this, "var", {});
    __publicField$1(this, "let", {});
    __publicField$1(this, "result");
    __publicField$1(this, "plots", {});
    __publicField$1(this, "marketData");
    __publicField$1(this, "source");
    __publicField$1(this, "tickerId");
    __publicField$1(this, "timeframe", "");
    __publicField$1(this, "limit");
    __publicField$1(this, "sDate");
    __publicField$1(this, "eDate");
    __publicField$1(this, "pineTSCode");
    this.marketData = marketData;
    this.source = source;
    this.tickerId = tickerId;
    this.timeframe = timeframe;
    this.limit = limit;
    this.sDate = sDate;
    this.eDate = eDate;
    this.math = new PineMath(this);
    this.ta = new TechnicalAnalysis(this);
    this.input = new Input(this);
    this.request = new PineRequest(this);
    this.array = new PineArray(this);
    const core = new Core(this);
    this.core = {
      plotchar: core.plotchar.bind(core),
      na: core.na.bind(core),
      color: core.color,
      plot: core.plot.bind(core),
      nz: core.nz.bind(core)
    };
  }
  //#region [Runtime functions] ===========================
  /**
   * this function is used to initialize the target variable with the source array
   * this array will represent a time series and its values will be shifted at runtime in order to mimic Pine script behavior
   * @param trg - the target variable name : used internally to maintain the series in the execution context
   * @param src - the source data, can be an array or a single value
   * @param idx - the index of the source array, used to get a sub-series of the source data
   * @returns the target array
   */
  init(trg, src, idx = 0) {
    if (!trg) {
      if (Array.isArray(src)) {
        trg = [this.precision(src[src.length - this.idx - 1 + idx])];
      } else {
        trg = [this.precision(src)];
      }
    } else {
      if (!Array.isArray(src) || Array.isArray(src[0])) {
        trg[0] = Array.isArray(src?.[0]) ? src[0] : this.precision(src);
      } else {
        trg[0] = this.precision(src[src.length - this.idx - 1 + idx]);
      }
    }
    return trg;
  }
  /**
       * this function is used to set the floating point precision of a number
       * by default it is set to 10 decimals which is the same as pine script
       * @param n - the number to be precision
       * @param decimals - the number of decimals to precision to
  
       * @returns the precision number
       */
  precision(n, decimals = 10) {
    if (typeof n !== "number" || isNaN(n)) return n;
    return Number(n.toFixed(decimals));
  }
  /**
   * This function is used to apply special transformation to internal PineTS parameters and handle them as time-series
   * @param source - the source data, can be an array or a single value
   * @param index - the index of the source array, used to get a sub-series of the source data
   * @param name - the name of the parameter, used as a unique identifier in the current execution context, this allows us to properly handle the param as a series
   * @returns the current value of the param
   */
  param(source, index, name) {
    if (typeof source === "string") return source;
    if (!Array.isArray(source) && typeof source === "object") return source;
    if (!this.params[name]) this.params[name] = [];
    if (Array.isArray(source)) {
      if (index) {
        this.params[name] = source.slice(index);
        this.params[name].length = source.length;
        return this.params[name];
      }
      this.params[name] = source.slice(0);
      return this.params[name];
    } else {
      this.params[name][0] = source;
      return this.params[name];
    }
  }
  //#endregion
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const BINANCE_API_URL = "https://api.binance.com/api/v3";
const timeframe_to_binance = {
  "1": "1m",
  // 1 minute
  "3": "3m",
  // 3 minutes
  "5": "5m",
  // 5 minutes
  "15": "15m",
  // 15 minutes
  "30": "30m",
  // 30 minutes
  "45": null,
  // 45 minutes (not directly supported by Binance, needs custom handling)
  "60": "1h",
  // 1 hour
  "120": "2h",
  // 2 hours
  "180": null,
  // 3 hours (not directly supported by Binance, needs custom handling)
  "240": "4h",
  // 4 hours
  "4H": "4h",
  // 4 hours
  "1D": "1d",
  // 1 day
  D: "1d",
  // 1 day
  "1W": "1w",
  // 1 week
  W: "1w",
  // 1 week
  "1M": "1M",
  // 1 month
  M: "1M"
  // 1 month
};
class CacheManager {
  constructor(cacheDuration = 5 * 60 * 1e3) {
    __publicField(this, "cache");
    __publicField(this, "cacheDuration");
    this.cache = /* @__PURE__ */ new Map();
    this.cacheDuration = cacheDuration;
  }
  generateKey(params) {
    return Object.entries(params).filter(([_, value]) => value !== void 0).map(([key, value]) => `${key}:${value}`).join("|");
  }
  get(params) {
    const key = this.generateKey(params);
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }
  set(params, data) {
    const key = this.generateKey(params);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  clear() {
    this.cache.clear();
  }
  // Optional: method to remove expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheDuration) {
        this.cache.delete(key);
      }
    }
  }
}
class BinanceProvider {
  constructor() {
    __publicField(this, "cacheManager");
    this.cacheManager = new CacheManager(5 * 60 * 1e3);
  }
  async getMarketDataInterval(tickerId, timeframe, sDate, eDate) {
    try {
      const interval = timeframe_to_binance[timeframe.toUpperCase()];
      if (!interval) {
        console.error(`Unsupported timeframe: ${timeframe}`);
        return [];
      }
      const timeframeDurations = {
        "1m": 60 * 1e3,
        "3m": 3 * 60 * 1e3,
        "5m": 5 * 60 * 1e3,
        "15m": 15 * 60 * 1e3,
        "30m": 30 * 60 * 1e3,
        "1h": 60 * 60 * 1e3,
        "2h": 2 * 60 * 60 * 1e3,
        "4h": 4 * 60 * 60 * 1e3,
        "1d": 24 * 60 * 60 * 1e3,
        "1w": 7 * 24 * 60 * 60 * 1e3,
        "1M": 30 * 24 * 60 * 60 * 1e3
      };
      let allData = [];
      let currentStart = sDate;
      const endTime = eDate;
      const intervalDuration = timeframeDurations[interval];
      if (!intervalDuration) {
        console.error(`Duration not defined for interval: ${interval}`);
        return [];
      }
      while (currentStart < endTime) {
        const chunkEnd = Math.min(currentStart + 1e3 * intervalDuration, endTime);
        const data = await this.getMarketData(
          tickerId,
          timeframe,
          1e3,
          // Max allowed by Binance
          currentStart,
          chunkEnd
        );
        if (data.length === 0) break;
        allData = allData.concat(data);
        currentStart = data[data.length - 1].closeTime + 1;
        if (data.length < 1e3) break;
      }
      return allData;
    } catch (error) {
      console.error("Error in getMarketDataInterval:", error);
      return [];
    }
  }
  //TODO : allow querying more than 1000 klines
  //TODO : immplement cache
  async getMarketData(tickerId, timeframe, limit, sDate, eDate) {
    try {
      const cacheParams = { tickerId, timeframe, limit, sDate, eDate };
      const cachedData = this.cacheManager.get(cacheParams);
      if (cachedData) {
        console.log("cache hit", tickerId, timeframe, limit, sDate, eDate);
        return cachedData;
      }
      const interval = timeframe_to_binance[timeframe.toUpperCase()];
      if (!interval) {
        console.error(`Unsupported timeframe: ${timeframe}`);
        return [];
      }
      let url = `${BINANCE_API_URL}/klines?symbol=${tickerId}&interval=${interval}`;
      if (!limit && sDate && eDate) {
        return this.getMarketDataInterval(tickerId, timeframe, sDate, eDate);
      }
      if (limit) {
        url += `&limit=${limit}`;
      }
      if (sDate) {
        url += `&startTime=${sDate}`;
      }
      if (eDate) {
        url += `&endTime=${eDate}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      const data = result.map((item) => {
        return {
          openTime: parseInt(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
          closeTime: parseInt(item[6]),
          quoteAssetVolume: parseFloat(item[7]),
          numberOfTrades: parseInt(item[8]),
          takerBuyBaseAssetVolume: parseFloat(item[9]),
          takerBuyQuoteAssetVolume: parseFloat(item[10]),
          ignore: item[11]
        };
      });
      this.cacheManager.set(cacheParams, data);
      return data;
    } catch (error) {
      console.error("Error in binance.klines:", error);
      return [];
    }
  }
}

const Provider = {
  Binance: new BinanceProvider()
  //TODO : add other providers (polygon, etc.)
};

export { Context, PineTS, Provider };
//# sourceMappingURL=pinets.dev.es.js.map
