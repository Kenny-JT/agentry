// GENERATED from packages/plugin/src by packages/plugin/build.mjs — DO NOT EDIT.
// Edit the source, then run: pnpm --filter @agentry/plugin build
import { createRequire as __agentryCreateRequire } from "node:module";
const require = __agentryCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path3) {
      const ctrl = callVisitor(key, node, visitor, path3);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path3, ctrl);
        return visit_(key, ctrl, visitor, path3);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path3 = Object.freeze(path3.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path3);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path3 = Object.freeze(path3.concat(node));
          const ck = visit_("key", node.key, visitor, path3);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path3);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path3) {
      const ctrl = await callVisitor(key, node, visitor, path3);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path3, ctrl);
        return visitAsync_(key, ctrl, visitor, path3);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path3 = Object.freeze(path3.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path3);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path3 = Object.freeze(path3.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path3);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path3);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path3) {
      if (typeof visitor === "function")
        return visitor(key, node, path3);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path3);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path3);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path3);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path3);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path3);
      return void 0;
    }
    function replaceNode(key, path3, node) {
      const parent = path3[path3.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path3, value) {
      let v = value;
      for (let i = path3.length - 1; i >= 0; --i) {
        const k = path3[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path3) => path3 == null || typeof path3 === "object" && !!path3[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path3, value) {
        if (isEmptyPath(path3))
          this.add(value);
        else {
          const [key, ...rest] = path3;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path3) {
        const [key, ...rest] = path3;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path3, keepScalar) {
        const [key, ...rest] = path3;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path3) {
        const [key, ...rest] = path3;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path3, value) {
        const [key, ...rest] = path3;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify2(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify2;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify2.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify2.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log2 = require_log();
    var merge = require_merge();
    var stringify2 = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify2.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log2.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify3 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify3(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify2.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify2.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify2.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify2.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify2.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document2 = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path3, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path3, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path3) {
        if (Collection.isEmptyPath(path3)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path3) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path3, keepScalar) {
        if (Collection.isEmptyPath(path3))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path3, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path3) {
        if (Collection.isEmptyPath(path3))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path3) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path3, value) {
        if (Collection.isEmptyPath(path3)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path3), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path3, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document2;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "…" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "…";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "…\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep2, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep2) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep2 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep2, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep2 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep2 + cb;
              sep2 = "";
              break;
            }
            case "newline":
              if (comment)
                sep2 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep2, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep2 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep2 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep2, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep2 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep2)
                for (const st of sep2) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep2, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep2 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep2 === " ")
            sep2 = "\n";
          else if (!prevMoreIndented && sep2 === "\n")
            sep2 = "\n\n";
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep2 === "\n")
            value += "\n";
          else
            sep2 = "\n";
        } else {
          value += sep2 + content;
          sep2 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts2 = token.source;
            if (ts2 && typeof ts2 === "string")
              length += ts2.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep2 = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep2 === "\n")
            res += sep2;
          else
            sep2 = "\n";
        } else {
          res += sep2 + match[1];
          sep2 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep2 + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "",
      // Unicode next line
      _: " ",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts2 = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts2} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document2 = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document2.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document2 = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document2.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify2 = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep2, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep2)
        for (const st of sep2)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify2;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path3) => {
      let item = cst;
      for (const [field, index] of path3) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path3) => {
      const parent = visit.itemAtPath(cst, path3.slice(0, -1));
      const field = path3[path3.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path3, item, visitor) {
      let ctrl = visitor(item, path3);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path3.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path3);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path3) : ctrl;
    }
    exports.visit = visit;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            case "?":
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep2;
          if (scalar.end) {
            sep2 = scalar.end;
            sep2.push(this.sourceToken);
            delete scalar.end;
          } else
            sep2 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep2 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep2 = it.sep;
                  sep2.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep2 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs3 = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs3, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs3);
              } else {
                Object.assign(it, { key: fs3, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs3 = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs3, sep: [] });
              else if (it.sep)
                this.stack.push(fs3);
              else
                Object.assign(it, { key: fs3, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep2 = fc.end.splice(1, fc.end.length);
            sep2.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep2 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document2 = require_Document();
    var errors = require_errors();
    var log2 = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse2(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log2.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify2(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document2.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse2;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify2;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document2 = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document2.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/agentry.ts
var import_yaml2 = __toESM(require_dist(), 1);
import * as fs2 from "node:fs";
import * as os from "node:os";
import * as path2 from "node:path";
import * as http from "node:http";
import { randomUUID } from "node:crypto";
import { exec, spawn as spawn2 } from "node:child_process";

// ../core/src/triggers.ts
var TRIGGER_KINDS = ["file", "schedule", "web", "mail", "git"];
var DURATION_RE = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)\s*$/i;
var UNIT_MS = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
function parseDuration(text) {
  if (typeof text !== "string") return null;
  const match = DURATION_RE.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const ms = Number(match[1]) * (UNIT_MS[match[2].toLowerCase()] ?? NaN);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
}
var DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
var dayIndex = (token) => DAY_NAMES.indexOf(token.slice(0, 3).toLowerCase());
function parseScheduleAt(text) {
  if (typeof text !== "string") return null;
  const match = /^\s*(?:([A-Za-z][A-Za-z,\- ]*?)\s+)?(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!match?.[2] || !match[3]) return null;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23 || minute > 59) return null;
  const dayText = match[1]?.trim().toLowerCase();
  if (!dayText || dayText === "daily" || dayText === "every day") return { hour, minute, days: null };
  if (dayText === "weekdays") return { hour, minute, days: /* @__PURE__ */ new Set([1, 2, 3, 4, 5]) };
  if (dayText === "weekends") return { hour, minute, days: /* @__PURE__ */ new Set([0, 6]) };
  const days = /* @__PURE__ */ new Set();
  for (const part of dayText.split(",").map((p) => p.trim()).filter(Boolean)) {
    const range = part.split("-").map((p) => p.trim());
    if (range.length === 2 && range[0] && range[1]) {
      const from = dayIndex(range[0]);
      const to = dayIndex(range[1]);
      if (from < 0 || to < 0) return null;
      for (let d = from; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === to) break;
      }
    } else if (range.length === 1 && range[0]) {
      const d = dayIndex(range[0]);
      if (d < 0) return null;
      days.add(d);
    } else {
      return null;
    }
  }
  return days.size ? { hour, minute, days } : null;
}
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var isStringList = (value) => value === void 0 || typeof value === "string" || Array.isArray(value) && value.every((v) => typeof v === "string");
function checkTriggers(raw) {
  const problems = [];
  if (raw === void 0) return problems;
  if (!isRecord(raw)) return [{ kind: "on", message: "`on` must map a trigger kind (file, schedule, web, mail, git) to its settings." }];
  for (const key of Object.keys(raw)) {
    if (!TRIGGER_KINDS.includes(key)) {
      problems.push({ kind: "on", field: key, message: `Unknown trigger "${key}" — expected one of ${TRIGGER_KINDS.join(", ")}.` });
    }
  }
  const settings = (kind) => {
    const value = raw[kind];
    if (value === void 0) return null;
    if (!isRecord(value)) {
      problems.push({ kind, message: `on.${kind} must be an object of settings.` });
      return null;
    }
    return value;
  };
  const duration = (kind, field, value) => {
    if (value === void 0) return;
    if (typeof value !== "string" || parseDuration(value) === null) {
      problems.push({ kind, field, message: `on.${kind}.${field} "${String(value)}" is not a duration like 30s, 15m or 2h.` });
    }
  };
  const file = settings("file");
  if (file) {
    if (typeof file.path !== "string" || !file.path.trim()) problems.push({ kind: "file", field: "path", message: "on.file needs the folder to watch (path)." });
    if (!isStringList(file.match)) problems.push({ kind: "file", field: "match", message: "on.file.match must be a glob or a list of globs." });
    if (!isStringList(file.ignore)) problems.push({ kind: "file", field: "ignore", message: "on.file.ignore must be a glob or a list of globs." });
    duration("file", "settle", file.settle);
  }
  const schedule = settings("schedule");
  if (schedule) {
    const hasAt = schedule.at !== void 0;
    const hasEvery = schedule.every !== void 0;
    if (hasAt === hasEvery) {
      problems.push({ kind: "schedule", message: 'on.schedule needs exactly one of `at` (a time like "Fri 17:00") or `every` (an interval like "15m").' });
    } else if (hasAt && (typeof schedule.at !== "string" || !parseScheduleAt(schedule.at))) {
      problems.push({ kind: "schedule", field: "at", message: `on.schedule.at "${String(schedule.at)}" is not a time like "17:00", "Fri 17:00" or "Mon-Fri 08:30".` });
    } else {
      duration("schedule", "every", schedule.every);
    }
  }
  const web = settings("web");
  if (web) {
    let ok = false;
    if (typeof web.url === "string") {
      try {
        const url = new URL(web.url);
        ok = url.protocol === "http:" || url.protocol === "https:";
      } catch {
        ok = false;
      }
    }
    if (!ok) problems.push({ kind: "web", field: "url", message: "on.web needs an http(s) url to watch." });
    duration("web", "every", web.every);
    if (web.initial !== void 0 && typeof web.initial !== "boolean") problems.push({ kind: "web", field: "initial", message: "on.web.initial must be true or false." });
  }
  const mail = settings("mail");
  if (mail) {
    if (mail.provider !== void 0 && mail.provider !== "gmail") problems.push({ kind: "mail", field: "provider", message: `on.mail.provider "${String(mail.provider)}" is not supported (only gmail).` });
    if (mail.query !== void 0 && typeof mail.query !== "string") problems.push({ kind: "mail", field: "query", message: "on.mail.query must be a search string." });
    duration("mail", "every", mail.every);
  }
  const git = settings("git");
  if (git) {
    if (typeof git.repo !== "string" || !git.repo.trim()) problems.push({ kind: "git", field: "repo", message: "on.git needs the repository to watch (repo)." });
    if (git.event !== void 0 && git.event !== "push" && git.event !== "commit") problems.push({ kind: "git", field: "event", message: `on.git.event "${String(git.event)}" must be push or commit.` });
    if (!isStringList(git.branch)) problems.push({ kind: "git", field: "branch", message: "on.git.branch must be a branch name or a list of them." });
  }
  return problems;
}

// ../core/src/artifacts.ts
var RUN_DIR_ROOT = ".agentry/runs";
var CHECKPOINT_FILE = "checkpoint.json";
var outputFileName = (nodeId) => `${nodeId}.output.json`;
var logFileName = (nodeId) => `${nodeId}.log.md`;

// ../core/src/serialize.ts
var import_yaml = __toESM(require_dist(), 1);

// ../core/src/tool.ts
var TOOL_KINDS = ["http", "read_file", "write_file", "script"];
var HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
var HTTP_TIMEOUT_S = 30;
var SCRIPT_TIMEOUT_S = 120;
var toolAgentLabel = (spec) => `tool:${spec?.kind ?? "unknown"}`;
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var isPositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
function checkToolSpec(id, raw) {
  const at = `agents.${id}.tool`;
  if (!isRecord2(raw)) return [`${at}: required object for a tool node`];
  const errors = [];
  const kind = raw.kind;
  if (typeof kind !== "string" || !TOOL_KINDS.includes(kind)) {
    return [`${at}.kind: expected one of ${TOOL_KINDS.join(", ")}, got ${JSON.stringify(kind)}`];
  }
  const needString = (field) => {
    if (typeof raw[field] !== "string" || !raw[field].trim()) errors.push(`${at}.${field}: required string`);
  };
  const checkTimeout = () => {
    if (raw.timeout_s !== void 0 && !isPositive(raw.timeout_s)) errors.push(`${at}.timeout_s: expected a positive number`);
  };
  switch (kind) {
    case "http":
      needString("url");
      if (raw.method !== void 0 && !HTTP_METHODS.includes(String(raw.method))) {
        errors.push(`${at}.method: expected one of ${HTTP_METHODS.join(", ")}, got ${JSON.stringify(raw.method)}`);
      }
      if (raw.headers !== void 0 && (!isRecord2(raw.headers) || Object.values(raw.headers).some((v) => typeof v !== "string"))) {
        errors.push(`${at}.headers: expected an object of string values`);
      }
      if (raw.body !== void 0 && typeof raw.body !== "string" && !isRecord2(raw.body)) errors.push(`${at}.body: expected a string or an object`);
      checkTimeout();
      break;
    case "read_file":
      needString("path");
      break;
    case "write_file":
      needString("path");
      if (raw.content !== void 0 && typeof raw.content !== "string") errors.push(`${at}.content: expected a string`);
      if (raw.mode !== void 0 && raw.mode !== "overwrite" && raw.mode !== "append") errors.push(`${at}.mode: expected "overwrite" or "append"`);
      break;
    case "script": {
      const cmd = raw.command;
      const okList = Array.isArray(cmd) && cmd.length > 0 && cmd.every((a) => typeof a === "string" || typeof a === "number");
      if (!okList && (typeof cmd !== "string" || !cmd.trim())) errors.push(`${at}.command: required string or non-empty string[]`);
      if (raw.cwd !== void 0 && typeof raw.cwd !== "string") errors.push(`${at}.cwd: expected a string`);
      checkTimeout();
      break;
    }
  }
  return errors;
}
var REF_RE = /\{([A-Za-z_][\w-]*)((?:\.[\w-]+)*)\}/g;
function templateRefs(template) {
  const refs = [];
  for (const m of template.matchAll(REF_RE)) {
    const root = m[1] ?? "";
    const path3 = (m[2] ?? "").split(".").filter(Boolean);
    refs.push({ raw: m[0], root, path: path3 });
  }
  return refs;
}
var scalarText = (value) => {
  if (value === void 0 || value === null) return void 0;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};
function lookupPath(text, path3) {
  let current = extractJson(text);
  if (current === null) {
    try {
      current = JSON.parse(text);
    } catch {
      return void 0;
    }
  }
  for (const key of path3) {
    if (Array.isArray(current)) current = current[Number(key)];
    else if (isRecord2(current)) current = current[key];
    else return void 0;
  }
  return current;
}
function renderTemplate(template, scope, encode = false) {
  const notices = [];
  const resolve3 = (ref) => {
    const inScope = ref.root === "input" || scope.sources.includes(ref.root);
    if (!inScope) return void 0;
    const source = ref.root === "input" ? scope.input : scope.outputs.get(ref.root);
    const value = source === void 0 ? void 0 : ref.path.length === 0 ? source : scalarText(lookupPath(source, ref.path));
    if (value === void 0) {
      notices.push(`${ref.raw} has no value — rendered as ""`);
      return "";
    }
    return value;
  };
  const text = template.replace(REF_RE, (raw, root, rest) => {
    const value = resolve3({ raw, root, path: rest.split(".").filter(Boolean) });
    if (value === void 0) return raw;
    return encode ? encodeURIComponent(value) : value;
  });
  return { text, notices };
}
function renderUrl(url, scope) {
  const trimmed = url.trim();
  const refs = templateRefs(trimmed);
  const whole = refs.length === 1 && refs[0]?.raw === trimmed;
  return renderTemplate(trimmed, scope, !whole);
}
function toolTemplateFields(spec) {
  const fields = [];
  switch (spec.kind) {
    case "http":
      fields.push({ field: "url", text: spec.url });
      for (const [key, value] of Object.entries(spec.headers ?? {})) fields.push({ field: `headers.${key}`, text: value });
      if (typeof spec.body === "string") fields.push({ field: "body", text: spec.body });
      else if (spec.body) {
        for (const [key, value] of Object.entries(spec.body)) if (typeof value === "string") fields.push({ field: `body.${key}`, text: value });
      }
      break;
    case "read_file":
      fields.push({ field: "path", text: spec.path });
      break;
    case "write_file":
      fields.push({ field: "path", text: spec.path });
      if (spec.content !== void 0) fields.push({ field: "content", text: spec.content });
      break;
    case "script":
      if (Array.isArray(spec.command)) spec.command.forEach((arg, i) => fields.push({ field: `command[${i}]`, text: String(arg) }));
      if (spec.cwd !== void 0) fields.push({ field: "cwd", text: spec.cwd });
      break;
  }
  return fields;
}

// ../core/src/runtime.ts
var RUNTIME_NAMES = ["opencode", "claude_code", "codex"];
var fromList = (from) => from === void 0 ? [] : Array.isArray(from) ? from : [from];
var FEEDBACK_DEFAULT_MAX = 3;
var FEEDBACK_MAX_LIMIT = 10;
var isValidFeedbackMax = (max) => typeof max === "number" && Number.isInteger(max) && max >= 1 && max <= FEEDBACK_MAX_LIMIT;
var isRecord3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var isRouter = (def) => def.type === "branch" || def.type === "decision" && !isBatchDecision(def.decision) && Boolean(def.branch_on?.trim());
function matchesCondition(output, cond) {
  const lower = output.toLowerCase().trim();
  if (cond.contains && !lower.includes(String(cond.contains).toLowerCase())) return false;
  if (cond.not_contains && lower.includes(String(cond.not_contains).toLowerCase())) return false;
  if (cond.equals && lower !== String(cond.equals).toLowerCase().trim()) return false;
  return true;
}
var hasCondition = (when) => when !== void 0 && Object.keys(when).length > 0;
function matchesRoute(value, when) {
  const str = String(value).toLowerCase().trim();
  const num = typeof value === "number" ? value : Number(value);
  if (when.equals !== void 0 && str !== String(when.equals).toLowerCase().trim()) return false;
  if (when.contains !== void 0 && !str.includes(String(when.contains).toLowerCase())) return false;
  if (when.not_contains !== void 0 && str.includes(String(when.not_contains).toLowerCase())) return false;
  if (when.gte !== void 0 && !(num >= when.gte)) return false;
  if (when.gt !== void 0 && !(num > when.gt)) return false;
  if (when.lte !== void 0 && !(num <= when.lte)) return false;
  if (when.lt !== void 0 && !(num < when.lt)) return false;
  return true;
}
function pickBranchRoute(routes, value) {
  return routes.find((route) => hasCondition(route.when) && matchesRoute(value, route.when)) ?? routes.find((route) => !hasCondition(route.when));
}
function branchParents(workflow) {
  const parents = /* @__PURE__ */ new Map();
  for (const [id, def] of Object.entries(workflow.agents)) {
    if (!isRouter(def) || !def.routes) continue;
    for (const route of def.routes) {
      const list = parents.get(route.to) ?? [];
      if (!list.includes(id)) list.push(id);
      parents.set(route.to, list);
    }
  }
  return parents;
}
function inputSources(def, parents = []) {
  const sources = [...fromList(def.input?.from)];
  for (const parent of parents) if (!sources.includes(parent)) sources.push(parent);
  return sources;
}
var joinMode = (def) => def.input?.join === "any" ? "any" : "all";
function strictJsonNodes(workflow) {
  const strict = /* @__PURE__ */ new Set();
  const parents = branchParents(workflow);
  for (const [id, def] of Object.entries(workflow.agents)) {
    if (def.type === "branch" && def.branch_on) strict.add(id);
    const select = def.input?.select;
    if (!isRecord3(select)) continue;
    const sources = inputSources(def, parents.get(id) ?? []);
    for (const upstream of Object.keys(select)) {
      const upstreamType = workflow.agents[upstream]?.type;
      if (sources.includes(upstream) && upstreamType !== "tool" && upstreamType !== "decision") strict.add(upstream);
    }
  }
  return strict;
}
function stripJsonFences(text) {
  const match = text.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match?.[1] !== void 0 ? match[1].trim() : text.trim();
}
function extractJson(text) {
  try {
    const parsed = JSON.parse(stripJsonFences(text));
    if (isRecord3(parsed)) return parsed;
  } catch {
  }
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth !== 0) continue;
      try {
        const parsed = JSON.parse(text.slice(start, i + 1));
        if (isRecord3(parsed)) return parsed;
      } catch {
      }
      return null;
    }
  }
  return null;
}
function sliceUpstream(text, fields) {
  if (!fields) return { text };
  if (fields.length === 0) return { text: "{}" };
  const parsed = extractJson(text);
  if (!parsed) return { text, fallback: { reason: "unparseable" } };
  const picked = {};
  const missing = [];
  for (const field of fields) {
    if (field in parsed) picked[field] = parsed[field];
    else missing.push(field);
  }
  const slice = { text: JSON.stringify(picked) };
  if (missing.length) slice.fallback = { reason: "missing-fields", missing };
  return slice;
}
function checkRunnable(raw) {
  const errors = [];
  if (!isRecord3(raw)) return { ok: false, errors: ["Workflow must be an object"] };
  if (typeof raw.introduction !== "string") errors.push("missing introduction");
  if (typeof raw.type !== "string") errors.push("missing type");
  if (!isRecord3(raw.input)) errors.push("missing input");
  if (!isRecord3(raw.output)) errors.push("missing output");
  const agents = isRecord3(raw.agents) ? raw.agents : null;
  if (!agents) errors.push("missing agents");
  const ids = new Set(agents ? Object.keys(agents) : []);
  for (const [id, value] of Object.entries(agents ?? {})) {
    if (!isRecord3(value)) {
      errors.push(`agents.${id}: not an object`);
      continue;
    }
    if (value.type === "tool") errors.push(...checkToolSpec(id, value.tool));
    else if (value.type === "decision") errors.push(...checkDecisionSpec(id, value.decision, value.routes !== void 0));
    else if (value.type !== "sub-workflow") {
      if (typeof value.prompt !== "string") errors.push(`agents.${id}: missing prompt`);
      if (!isRecord3(value.agent_mapping)) errors.push(`agents.${id}: missing agent_mapping`);
      else {
        for (const host2 of RUNTIME_NAMES) {
          const name = value.agent_mapping[host2];
          if (name !== void 0 && typeof name !== "string") errors.push(`agents.${id}.agent_mapping.${host2}: expected a string`);
        }
      }
    }
    const input = isRecord3(value.input) ? value.input : null;
    if (input?.from !== void 0) {
      for (const ref of Array.isArray(input.from) ? input.from : [input.from]) {
        if (typeof ref !== "string") errors.push(`agents.${id}.input.from: expected string or string[], got ${typeof ref}`);
        else if (!ids.has(ref)) errors.push(`agents.${id}.input.from: references unknown agent "${ref}"`);
      }
    }
    if (input?.join !== void 0 && input.join !== "all" && input.join !== "any") {
      errors.push(`agents.${id}.input.join: expected "all" or "any", got ${JSON.stringify(input.join)}`);
    }
    if (input?.feedback !== void 0) {
      const feedback = input.feedback;
      if (!isRecord3(feedback)) errors.push(`agents.${id}.input.feedback: expected object`);
      else {
        if (typeof feedback.from !== "string") errors.push(`agents.${id}.input.feedback.from: required string`);
        else if (!ids.has(feedback.from)) errors.push(`agents.${id}.input.feedback.from: references unknown agent "${feedback.from}"`);
        if (feedback.when !== void 0 && !isRecord3(feedback.when)) errors.push(`agents.${id}.input.feedback.when: expected object`);
        if (feedback.max !== void 0 && !isValidFeedbackMax(feedback.max)) {
          errors.push(`agents.${id}.input.feedback.max: expected an integer from 1 to ${FEEDBACK_MAX_LIMIT}`);
        }
      }
    }
    if (input?.select !== void 0) {
      if (!isRecord3(input.select)) errors.push(`agents.${id}.input.select: expected an object of upstream id -> field list`);
      else {
        for (const [upstream, fields] of Object.entries(input.select)) {
          if (!Array.isArray(fields) || fields.some((field) => typeof field !== "string")) {
            errors.push(`agents.${id}.input.select.${upstream}: expected a list of field names`);
          }
        }
      }
    }
    if (isRecord3(value.trigger)) {
      const { when, loop } = value.trigger;
      if (when !== void 0) {
        if (!isRecord3(when)) errors.push(`agents.${id}.trigger.when: expected object`);
        else if (typeof when.from !== "string") errors.push(`agents.${id}.trigger.when.from: required string`);
        else if (!ids.has(when.from)) errors.push(`agents.${id}.trigger.when.from: references unknown agent "${when.from}"`);
      }
      if (loop !== void 0) {
        if (!isRecord3(loop)) errors.push(`agents.${id}.trigger.loop: expected object`);
        else if (typeof loop.max !== "number" || loop.max < 1) errors.push(`agents.${id}.trigger.loop.max: required positive number`);
      }
    }
    if ((value.type === "branch" || value.type === "decision") && value.routes !== void 0) {
      if (!Array.isArray(value.routes)) errors.push(`agents.${id}.routes: expected a list`);
      else {
        value.routes.forEach((route, index) => {
          if (!isRecord3(route) || typeof route.to !== "string") errors.push(`agents.${id}.routes[${index}].to: required string`);
          else if (!ids.has(route.to)) errors.push(`agents.${id}.routes[${index}].to: references unknown agent "${route.to}"`);
        });
      }
    }
  }
  if (!Array.isArray(raw.workflow)) errors.push("missing workflow array");
  else if (agents) {
    for (const item of raw.workflow) {
      if (typeof item !== "string") errors.push("workflow[]: expected string");
      else if (!ids.has(item)) errors.push(`workflow[]: unknown node "${item}"`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, workflow: raw };
}

// ../core/src/decision.ts
var DECISION_QUESTION_TYPES = ["choice", "yes_no", "score"];
var DECISION_DEFAULT_MODEL = "jev-latest";
var SCORE_LEVELS_MIN = 2;
var SCORE_LEVELS_MAX = 10;
var RESERVED_NAMES = ["unsure", "backend", "items", "counts", "index"];
var NAME_RE = /^[A-Za-z_]\w*$/;
var isRecord4 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var isText = (value) => typeof value === "string" && value.trim().length > 0;
function checkQuestion(at, name, raw, errors) {
  if (!NAME_RE.test(name) || RESERVED_NAMES.includes(name)) {
    errors.push(`${at}: question name must be an identifier and not one of ${RESERVED_NAMES.join(", ")}`);
  }
  if (!isRecord4(raw)) {
    errors.push(`${at}: expected an object`);
    return;
  }
  const type = raw.type;
  if (typeof type !== "string" || !DECISION_QUESTION_TYPES.includes(type)) {
    errors.push(`${at}.type: expected one of ${DECISION_QUESTION_TYPES.join(", ")}, got ${JSON.stringify(type)}`);
    return;
  }
  if (!isText(raw.instructions)) errors.push(`${at}.instructions: required string`);
  switch (type) {
    case "choice": {
      const options = raw.options;
      if (!isRecord4(options) || Object.keys(options).length < 2) errors.push(`${at}.options: expected an object with at least two options`);
      else if (Object.values(options).some((v) => v !== null && typeof v !== "string")) errors.push(`${at}.options: descriptions must be strings or null`);
      break;
    }
    case "score": {
      const levels = raw.levels;
      if (!Array.isArray(levels) || levels.length < SCORE_LEVELS_MIN || levels.length > SCORE_LEVELS_MAX || !levels.every(isText)) {
        errors.push(`${at}.levels: expected ${SCORE_LEVELS_MIN}..${SCORE_LEVELS_MAX} level descriptions`);
      }
      break;
    }
    case "yes_no":
      break;
  }
}
function checkDecisionSpec(id, raw, hasRoutes = false) {
  const at = `agents.${id}.decision`;
  if (!isRecord4(raw)) return [`${at}: required object for a decision node`];
  const errors = [];
  const questions = raw.questions;
  if (!isRecord4(questions) || Object.keys(questions).length === 0) errors.push(`${at}.questions: required non-empty object`);
  else for (const [name, question] of Object.entries(questions)) checkQuestion(`${at}.questions.${name}`, name, question, errors);
  if (raw.model !== void 0 && !isText(raw.model)) errors.push(`${at}.model: expected a string`);
  if (raw.state !== void 0 && typeof raw.state !== "string") errors.push(`${at}.state: expected a string`);
  if (raw.for_each !== void 0 && !isText(raw.for_each)) errors.push(`${at}.for_each: expected a template string`);
  const min = raw.min_confidence;
  if (min !== void 0 && (typeof min !== "number" || !(min >= 0 && min <= 1))) errors.push(`${at}.min_confidence: expected a number between 0 and 1`);
  if (hasRoutes && raw.for_each !== void 0) errors.push(`${at}.for_each: a batch decision cannot route (remove routes or for_each)`);
  return errors;
}
var isBatchDecision = (spec) => isText(spec?.for_each);
var confidenceField = (name, question) => question.type === "yes_no" ? `${name}_p` : `${name}_confidence`;
function decisionOutputSchema(spec) {
  if (isBatchDecision(spec)) return { items: "object[]", counts: "object", unsure: "number[]", backend: "string" };
  const schema = {};
  for (const [name, question] of Object.entries(spec.questions)) {
    schema[name] = question.type === "choice" ? "string" : question.type === "yes_no" ? "boolean" : "number";
    schema[confidenceField(name, question)] = "number";
  }
  schema.unsure = "string[]";
  schema.backend = "string";
  return schema;
}
var decisionAgentLabel = (backend) => `decision:${backend}`;
function toJevQuestions(spec) {
  const out = {};
  for (const [name, q] of Object.entries(spec.questions)) {
    switch (q.type) {
      case "choice":
        out[name] = { type: "choice", instructions: q.instructions, criteria: q.options };
        break;
      case "score":
        out[name] = { type: "score", instructions: q.instructions, criteria: q.levels };
        break;
      case "yes_no":
        out[name] = { type: "noul", instructions: q.instructions };
        break;
    }
  }
  return out;
}
var parseJsonText = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return extractJson(text) ?? text;
  }
};
function decisionStates(spec, scope) {
  const notices = [];
  if (isText(spec.for_each)) {
    const rendered = renderTemplate(spec.for_each, scope);
    notices.push(...rendered.notices);
    const list = parseJsonText(rendered.text);
    if (!Array.isArray(list)) throw new Error(`decision.for_each must resolve to a JSON array, got ${typeof list === "string" ? "text" : typeof list}`);
    return { states: list, notices };
  }
  if (typeof spec.state === "string") {
    const rendered = renderTemplate(spec.state, scope);
    notices.push(...rendered.notices);
    return { states: [parseJsonText(rendered.text)], notices };
  }
  const upstream = {};
  for (const id of scope.sources) {
    const text = scope.outputs.get(id);
    if (text !== void 0) upstream[id] = parseJsonText(text);
  }
  if (Object.keys(upstream).length === 0) return { states: [scope.input === void 0 ? {} : parseJsonText(scope.input)], notices };
  return { states: [upstream], notices };
}

// ../core/src/loops.ts
var RUN_EXECUTION_BUDGET = 200;
function dependencyGraph(workflow) {
  const parents = branchParents(workflow);
  const deps = /* @__PURE__ */ new Map();
  for (const [id, def] of Object.entries(workflow.agents)) {
    const upstream = [...fromList(def.input?.from)];
    for (const parent of parents.get(id) ?? []) if (!upstream.includes(parent)) upstream.push(parent);
    const gate = def.trigger?.when?.from;
    if (gate && !upstream.includes(gate)) upstream.push(gate);
    deps.set(id, upstream.filter((dep) => workflow.agents[dep] !== void 0));
  }
  return deps;
}
function findCycles(deps) {
  const cycles = [];
  const reported = /* @__PURE__ */ new Set();
  const done = /* @__PURE__ */ new Set();
  const stack = [];
  const onStack = /* @__PURE__ */ new Set();
  const visit = (id) => {
    if (done.has(id)) return;
    if (onStack.has(id)) {
      const cycle = stack.slice(stack.indexOf(id));
      const key = [...cycle].sort().join("\0");
      if (!reported.has(key)) {
        reported.add(key);
        cycles.push(cycle);
      }
      return;
    }
    stack.push(id);
    onStack.add(id);
    for (const dep of deps.get(id) ?? []) visit(dep);
    stack.pop();
    onStack.delete(id);
    done.add(id);
  };
  for (const id of deps.keys()) visit(id);
  return cycles.map((cycle) => {
    const flowOrder = [...cycle].reverse();
    const start = flowOrder.indexOf(cycle[0] ?? "");
    return [...flowOrder.slice(start), ...flowOrder.slice(0, start)];
  });
}
function reach(start, step) {
  const seen = /* @__PURE__ */ new Set();
  const queue = [start];
  for (let current = queue.shift(); current !== void 0; current = queue.shift()) {
    for (const next of step(current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}
function feedbackLoopBody(workflow, nodeId) {
  const from = workflow.agents[nodeId]?.input?.feedback?.from;
  if (!from || !workflow.agents[from]) return null;
  const deps = dependencyGraph(workflow);
  const children = /* @__PURE__ */ new Map();
  for (const [id, upstream] of deps) {
    for (const dep of upstream) children.set(dep, [...children.get(dep) ?? [], id]);
  }
  const downstream = reach(nodeId, (id) => children.get(id) ?? []);
  if (!downstream.has(from)) return null;
  const ancestors = reach(from, (id) => deps.get(id) ?? []);
  const body = /* @__PURE__ */ new Set([nodeId, from]);
  for (const id of downstream) if (ancestors.has(id)) body.add(id);
  return body;
}

// ../core/src/validate.ts
var asList = (from) => from === void 0 ? [] : Array.isArray(from) ? from : [from];
function toolIssues(id, def, sources) {
  const issues = [];
  if (!def.tool) {
    issues.push({ severity: "error", code: "tool-missing", nodeId: id, field: "tool", message: `"${id}" is a tool node but has no tool block.` });
    return issues;
  }
  for (const message of checkToolSpec(id, def.tool)) {
    issues.push({ severity: "error", code: "tool-invalid", nodeId: id, field: "tool", message });
  }
  if (issues.length) return issues;
  for (const { field, text } of toolTemplateFields(def.tool)) {
    for (const ref of templateRefs(text)) {
      if (ref.root === "input" || sources.includes(ref.root)) continue;
      issues.push({
        severity: "warning",
        code: "template-unknown-source",
        nodeId: id,
        field,
        message: `"${id}" references ${ref.raw} in tool.${field}, but "${ref.root}" is not an upstream of this node (nor "input") — it is left as written.`
      });
    }
  }
  return issues;
}
function feedbackIssues(id, workflow) {
  const feedback = workflow.agents[id]?.input?.feedback;
  if (!feedback) return [];
  const issues = [];
  const from = feedback.from;
  if (!workflow.agents[from]) {
    issues.push({ severity: "error", code: "feedback-unknown", nodeId: id, field: from, message: `"${id}" loops back from "${from}", which is not a node in this workflow.` });
  } else if (!feedbackLoopBody(workflow, id)) {
    issues.push({ severity: "error", code: "feedback-not-loop", nodeId: id, field: from, message: `"${id}" loops back from "${from}", but "${from}" is not downstream of "${id}" — a loop-back edge must return from a node this one leads to.` });
  }
  if (feedback.max !== void 0 && !isValidFeedbackMax(feedback.max)) {
    issues.push({ severity: "error", code: "feedback-max", nodeId: id, field: "max", message: `"${id}" loops back with max ${JSON.stringify(feedback.max)}; expected a whole number from 1 to ${FEEDBACK_MAX_LIMIT}.` });
  }
  if (!feedback.when || Object.keys(feedback.when).length === 0) {
    issues.push({ severity: "warning", code: "loop-no-exit", nodeId: id, message: `"${id}" loops back from "${from}" without a condition, so it always runs the full ${feedback.max ?? "default"} extra rounds.` });
  }
  return issues;
}
function decisionIssues(id, def, sources) {
  const issues = [];
  if (!def.decision) {
    issues.push({ severity: "error", code: "decision-missing", nodeId: id, field: "decision", message: `"${id}" is a decision node but has no decision block.` });
    return issues;
  }
  for (const message of checkDecisionSpec(id, def.decision, def.routes !== void 0)) {
    issues.push({ severity: "error", code: "decision-invalid", nodeId: id, field: "decision", message });
  }
  if (issues.length) return issues;
  const templated = [{ field: "state", text: def.decision.state }, { field: "for_each", text: def.decision.for_each }];
  for (const { field, text } of templated) {
    if (text === void 0) continue;
    for (const ref of templateRefs(text)) {
      if (ref.root === "input" || sources.includes(ref.root)) continue;
      issues.push({
        severity: "warning",
        code: "template-unknown-source",
        nodeId: id,
        field,
        message: `"${id}" references ${ref.raw} in decision.${field}, but "${ref.root}" is not an upstream of this node (nor "input") — it is left as written.`
      });
    }
  }
  return issues;
}
function validateWorkflow(workflow) {
  const issues = [];
  const agents = workflow.agents ?? {};
  const ids = Object.keys(agents);
  const has = (id) => Boolean(agents[id]);
  const fieldsOf = (id) => {
    const def = agents[id];
    if (def?.type === "decision" && def.decision) return Object.keys(decisionOutputSchema(def.decision));
    return Object.keys(def?.output?.schema ?? {});
  };
  const parents = branchParents({ agents });
  const consumed = /* @__PURE__ */ new Set();
  const fed = /* @__PURE__ */ new Set();
  for (const cycle of findCycles(dependencyGraph({ agents }))) {
    const path3 = [...cycle, cycle[0]].map((node) => `"${node}"`).join(" → ");
    issues.push({
      severity: "error",
      code: "cycle",
      nodeId: cycle[0],
      message: `${path3} is a cycle: every node waits for the one before it, so none can start. Turn one edge into a loop-back edge (input.feedback) to repeat these steps.`
    });
  }
  for (const id of ids) {
    const def = agents[id];
    if (!def) continue;
    if (def.type === "tool") issues.push(...toolIssues(id, def, inputSources(def, parents.get(id) ?? [])));
    if (def.type === "decision") issues.push(...decisionIssues(id, def, inputSources(def, parents.get(id) ?? [])));
    const feedback = feedbackIssues(id, { agents });
    issues.push(...feedback);
    if (def.input?.feedback && !feedback.some((issue) => issue.severity === "error")) {
      consumed.add(def.input.feedback.from);
      fed.add(id);
    }
    for (const from of asList(def.input?.from)) {
      if (has(from)) {
        consumed.add(from);
        fed.add(id);
      } else {
        issues.push({
          severity: "error",
          code: "unknown-input",
          nodeId: id,
          field: from,
          message: `"${id}" reads from "${from}", which is not a node in this workflow.`
        });
      }
    }
    if (isRouter(def) && def.routes) {
      let feeds = false;
      for (const route of def.routes) {
        if (has(route.to)) {
          fed.add(route.to);
          feeds = true;
        } else {
          issues.push({
            severity: "error",
            code: "unknown-route",
            nodeId: id,
            field: route.to,
            message: `Branch "${id}" routes to "${route.to}", which is not a node in this workflow.`
          });
        }
      }
      if (feeds) consumed.add(id);
      const routeField = def.branch_on?.trim();
      const hasConditions = def.routes.some((route) => route.when && Object.keys(route.when).length > 0);
      if (routeField) {
        if (!fieldsOf(id).includes(routeField)) {
          issues.push({
            severity: "error",
            code: "branch-field-missing",
            nodeId: id,
            field: routeField,
            message: `Branch "${id}" routes on "${routeField}", but its output schema declares no such field.`
          });
        }
      } else if (hasConditions) {
        issues.push({
          severity: "error",
          code: "branch-on-missing",
          nodeId: id,
          message: `Branch "${id}" has conditional routes but no "route on" output field selected.`
        });
      }
      const defaults = def.routes.filter((route) => !route.when || Object.keys(route.when).length === 0);
      for (const unreachable of defaults.slice(1)) {
        issues.push({
          severity: "warning",
          code: "branch-extra-default",
          nodeId: id,
          field: unreachable.to,
          message: `Branch "${id}" has more than one default (else) port; only the first, "${defaults[0]?.to}", is ever taken, so "${unreachable.to}" never runs from it.`
        });
      }
      const targets = new Set(def.routes.map((route) => route.to));
      for (const consumer of ids) {
        const consumerDef = agents[consumer];
        if (!consumerDef || joinMode(consumerDef) === "any") continue;
        const alternatives = asList(consumerDef.input?.from).filter((from) => targets.has(from));
        if (alternatives.length < 2) continue;
        issues.push({
          severity: "warning",
          code: "join-all-over-branch",
          nodeId: consumer,
          field: id,
          message: `"${consumer}" merges alternative ports of branch "${id}" (${alternatives.join(", ")}) but waits for all of them, so it will always be skipped. Set "Fire when" to any upstream.`
        });
      }
    }
    const join3 = def.input?.join;
    if (join3 !== void 0 && join3 !== "all" && join3 !== "any") {
      issues.push({
        severity: "error",
        code: "join-invalid",
        nodeId: id,
        field: "join",
        message: `"${id}" has input.join "${String(join3)}"; expected "all" or "any".`
      });
    }
    for (const [upstream, kept] of Object.entries(def.input?.select ?? {})) {
      if (!has(upstream)) {
        issues.push({
          severity: "warning",
          code: "select-unknown-source",
          nodeId: id,
          field: upstream,
          message: `"${id}" selects fields from "${upstream}", which is not a node in this workflow.`
        });
        continue;
      }
      const produced = fieldsOf(upstream);
      for (const keptField of kept) {
        if (!produced.includes(keptField)) {
          issues.push({
            severity: "warning",
            code: "select-field-unknown",
            nodeId: id,
            field: keptField,
            message: `"${id}" keeps "${upstream}.${keptField}", but "${upstream}" declares no such output field.`
          });
        }
      }
    }
    const triggerFrom = def.trigger?.when?.from?.trim();
    if (triggerFrom && !has(triggerFrom)) {
      issues.push({
        severity: "error",
        code: "unknown-trigger",
        nodeId: id,
        field: triggerFrom,
        message: `"${id}" triggers on "${triggerFrom}", which is not a node in this workflow.`
      });
    }
  }
  for (const problem of checkTriggers(workflow.on)) {
    issues.push({
      severity: "error",
      code: "trigger-invalid",
      field: problem.field ? `${problem.kind}.${problem.field}` : problem.kind,
      message: problem.message
    });
  }
  for (const id of workflow.input?.to ?? []) if (has(id)) fed.add(id);
  const outputFrom = workflow.output?.from ?? [];
  for (const id of outputFrom) if (has(id)) consumed.add(id);
  const outputRequired = Object.keys(workflow.output?.schema ?? {});
  if (outputRequired.length) {
    const produced = new Set(outputFrom.flatMap(fieldsOf));
    for (const field of outputRequired) {
      if (!produced.has(field)) {
        issues.push({
          severity: "error",
          code: "output-field-unsatisfied",
          field,
          message: `Workflow output needs "${field}", but no node wired to OUT produces it.`
        });
      }
    }
    if (!outputFrom.length) {
      issues.push({
        severity: "warning",
        code: "output-unconnected",
        message: "Workflow output declares required fields, but no node is wired to OUT."
      });
    }
  }
  const documenters = ids.filter((id) => agents[id]?.type === "documenter");
  if (documenters.length > 1) {
    for (const id of documenters) {
      issues.push({
        severity: "error",
        code: "multiple-documenters",
        nodeId: id,
        message: `A workflow can have at most one documenter (its output is the whole-run log.md), but found ${documenters.length}.`
      });
    }
  }
  for (const id of ids) {
    if (consumed.has(id) && fieldsOf(id).length === 0) {
      issues.push({
        severity: "warning",
        code: "empty-output",
        nodeId: id,
        message: `"${id}" is read by a downstream node but declares no output fields.`
      });
    }
    if (!consumed.has(id) && !fed.has(id) && agents[id]?.type !== "documenter") {
      issues.push({
        severity: "warning",
        code: "disconnected",
        nodeId: id,
        message: `"${id}" is not connected to anything.`
      });
    }
  }
  return issues;
}

// ../core/src/decisionAnswers.ts
var isRecord5 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var clamp01 = (x) => Math.max(0, Math.min(1, x));
var round3 = (x) => Math.round(x * 1e3) / 1e3;
function choiceConfidence(probabilities) {
  const n = probabilities.length;
  if (n < 2) return 1;
  return clamp01((Math.max(...probabilities) - 1 / n) / (1 - 1 / n));
}
function scoreConfidence(probabilities) {
  const n = probabilities.length;
  if (n < 2) return 1;
  const m = probabilities.indexOf(Math.max(...probabilities));
  const spread = probabilities.reduce((sum, p, i) => sum + p * Math.abs(i - m), 0);
  const even = probabilities.reduce((sum, _, i) => sum + Math.abs(i - (n - 1) / 2), 0) / n;
  return clamp01(1 - spread / even);
}
var yesNoConfidence = (p) => clamp01(Math.abs(2 * p - 1));
var answerConfidence = (answer) => answer.type === "yes_no" ? yesNoConfidence(answer.p) : answer.confidence;
function normalize(weights) {
  const safe = weights.map((w) => Number.isFinite(w) && w > 0 ? w : 0);
  const total = safe.reduce((a, b) => a + b, 0);
  return total > 0 ? safe.map((w) => w / total) : safe.map(() => 1 / safe.length);
}
var argmax = (values) => values.indexOf(Math.max(...values));
var expectedLevel = (probabilities) => round3(probabilities.reduce((sum, p, i) => sum + p * i, 0));
function fromJevAnswers(spec, raw) {
  if (!isRecord5(raw)) throw new Error("Jev response has no answers object");
  const out = {};
  for (const [name, q] of Object.entries(spec.questions)) {
    const a = raw[name];
    if (!isRecord5(a)) throw new Error(`Jev answered nothing for "${name}"`);
    switch (q.type) {
      case "choice": {
        const given = a.probabilities;
        if (typeof a.choice !== "string" || !isRecord5(given)) throw new Error(`Jev answer "${name}" is not a choice`);
        const probabilities = Object.fromEntries(Object.keys(q.options).map((opt) => [opt, Number(given[opt] ?? 0)]));
        const confidence = typeof a.confidence === "number" ? a.confidence : choiceConfidence(Object.values(probabilities));
        out[name] = { type: "choice", choice: a.choice, probabilities, confidence };
        break;
      }
      case "score": {
        const given = a.probabilities;
        if (typeof a.score !== "number" || !isRecord5(given)) throw new Error(`Jev answer "${name}" is not a score`);
        const probabilities = q.levels.map((_, i) => Number(given[String(i)] ?? 0));
        const confidence = typeof a.confidence === "number" ? a.confidence : scoreConfidence(probabilities);
        out[name] = { type: "score", score: a.score, probabilities, confidence };
        break;
      }
      case "yes_no": {
        if (typeof a.noul !== "number") throw new Error(`Jev answer "${name}" is not a noul`);
        out[name] = { type: "yes_no", p: clamp01(a.noul) };
        break;
      }
    }
  }
  return out;
}
function describeQuestion(name, q) {
  switch (q.type) {
    case "choice": {
      const options = Object.entries(q.options).map(([opt, desc]) => desc ? `"${opt}" (${desc})` : `"${opt}"`).join(", ");
      return `- "${name}" (choice): ${q.instructions}
  Answer: an object mapping EVERY option to its probability, summing to 1. Options: ${options}.`;
    }
    case "yes_no":
      return `- "${name}" (yes/no): ${q.instructions}
  Answer: the probability (0..1) that this statement is true.`;
    case "score":
      return `- "${name}" (score): ${q.instructions}
  Answer: an array of ${q.levels.length} probabilities, one per level in order, summing to 1. Levels: ${q.levels.map((l, i) => `${i} = ${l}`).join("; ")}.`;
  }
}
function decisionPrompt(spec, state) {
  const stateText = typeof state === "string" ? state : JSON.stringify(state, null, 2);
  return [
    "You are a calibrated classifier. Judge the STATE below and answer every question with probabilities that reflect your actual uncertainty.",
    "",
    "STATE:",
    stateText,
    "",
    "QUESTIONS:",
    ...Object.entries(spec.questions).map(([name, q]) => describeQuestion(name, q)),
    "",
    `Respond with ONLY a raw JSON object whose keys are exactly: ${Object.keys(spec.questions).map((n) => `"${n}"`).join(", ")}. No prose, no code fences.`
  ].join("\n");
}
function choiceFromLlm(q, value) {
  const options = Object.keys(q.options);
  let weights;
  if (typeof value === "string") weights = options.map((opt) => opt.toLowerCase() === value.trim().toLowerCase() ? 1 : 0);
  else if (isRecord5(value)) weights = options.map((opt) => Number(value[opt] ?? 0));
  else return void 0;
  if (!weights.some((w) => w > 0)) return void 0;
  const probabilities = normalize(weights);
  const choice = options[argmax(probabilities)] ?? options[0] ?? "";
  return { type: "choice", choice, probabilities: Object.fromEntries(options.map((opt, i) => [opt, probabilities[i] ?? 0])), confidence: choiceConfidence(probabilities) };
}
function scoreFromLlm(q, value) {
  let weights;
  if (Array.isArray(value) && value.length === q.levels.length) weights = value.map(Number);
  else if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < q.levels.length) weights = q.levels.map((_, i) => i === value ? 1 : 0);
  else if (isRecord5(value)) weights = q.levels.map((level, i) => Number(value[String(i)] ?? value[level] ?? 0));
  else return void 0;
  if (!weights.some((w) => w > 0)) return void 0;
  const probabilities = normalize(weights);
  return { type: "score", score: expectedLevel(probabilities), probabilities, confidence: scoreConfidence(probabilities) };
}
function yesNoFromLlm(value) {
  if (typeof value === "boolean") return { type: "yes_no", p: value ? 1 : 0 };
  if (typeof value === "number" && Number.isFinite(value)) return { type: "yes_no", p: clamp01(value) };
  if (isRecord5(value) && typeof value.p === "number") return { type: "yes_no", p: clamp01(value.p) };
  return void 0;
}
function parseLlmAnswers(spec, text) {
  const parsed = extractJson(text);
  if (!parsed) throw new Error("fallback reply holds no JSON object");
  const out = {};
  for (const [name, q] of Object.entries(spec.questions)) {
    const value = parsed[name];
    const answer = q.type === "choice" ? choiceFromLlm(q, value) : q.type === "score" ? scoreFromLlm(q, value) : yesNoFromLlm(value);
    if (!answer) throw new Error(`fallback reply has no usable answer for "${name}": ${JSON.stringify(value)}`);
    out[name] = answer;
  }
  return out;
}
var answerValue = (answer) => answer.type === "choice" ? answer.choice : answer.type === "score" ? answer.score : answer.p >= 0.5;
function decisionRecord(spec, answers) {
  const record = {};
  const unsure = [];
  const threshold = spec.min_confidence ?? 0;
  for (const [name, q] of Object.entries(spec.questions)) {
    const answer = answers[name];
    if (!answer) continue;
    record[name] = answerValue(answer);
    record[confidenceField(name, q)] = round3(answer.type === "yes_no" ? answer.p : answer.confidence);
    if (answerConfidence(answer) < threshold) unsure.push(name);
  }
  return { ...record, unsure };
}
function batchRecord(spec, perItem) {
  const counts = {};
  for (const [name, q] of Object.entries(spec.questions)) if (q.type !== "score") counts[name] = {};
  const unsure = [];
  const items = perItem.map((answers, index) => {
    const { unsure: itemUnsure, ...rest } = decisionRecord(spec, answers);
    if (itemUnsure.length) unsure.push(index);
    for (const name of Object.keys(counts)) {
      const key = String(rest[name]);
      const tally = counts[name] ?? {};
      tally[key] = (tally[key] ?? 0) + 1;
      counts[name] = tally;
    }
    return { index, ...rest };
  });
  return { items, counts, unsure };
}

// ../design/src/theme.ts
var DARK_THEME = {
  id: "dark",
  label: "Default Dark",
  mode: "dark",
  swatch: {
    bg: "#0b0d10",
    surface: "#161a20",
    text: "#e6edf3",
    accent: "#4d9eff",
    hues: ["#4d9eff", "#bc8cff", "#f0883e", "#3fb950", "#f778ba"]
  }
};
var THEMES = [
  DARK_THEME,
  {
    id: "dracula",
    label: "Dracula",
    mode: "dark",
    swatch: {
      bg: "#282a36",
      surface: "#44475a",
      text: "#f8f8f2",
      accent: "#bd93f9",
      hues: ["#ff5555", "#ffb86c", "#50fa7b", "#8be9fd", "#ff79c6"]
    }
  },
  {
    id: "nord",
    label: "Nord",
    mode: "dark",
    swatch: {
      bg: "#2e3440",
      surface: "#3b4252",
      text: "#eceff4",
      accent: "#88c0d0",
      hues: ["#bf616a", "#d08770", "#a3be8c", "#81a1c1", "#b48ead"]
    }
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    mode: "dark",
    swatch: {
      bg: "#002b36",
      surface: "#073642",
      text: "#93a1a1",
      accent: "#268bd2",
      hues: ["#dc322f", "#cb4b16", "#859900", "#2aa198", "#6c71c4"]
    }
  },
  {
    id: "gruvbox-dark",
    label: "Gruvbox Dark",
    mode: "dark",
    swatch: {
      bg: "#282828",
      surface: "#3c3836",
      text: "#ebdbb2",
      accent: "#fe8019",
      hues: ["#fb4934", "#fabd2f", "#b8bb26", "#83a598", "#d3869b"]
    }
  },
  {
    id: "one-dark",
    label: "One Dark",
    mode: "dark",
    swatch: {
      bg: "#282c34",
      surface: "#3e4451",
      text: "#abb2bf",
      accent: "#61afef",
      hues: ["#e06c75", "#d19a66", "#98c379", "#56b6c2", "#c678dd"]
    }
  },
  {
    id: "monokai",
    label: "Monokai",
    mode: "dark",
    swatch: {
      bg: "#2d2a2e",
      surface: "#3e3b37",
      text: "#fcfcfa",
      accent: "#78dce8",
      hues: ["#ff6188", "#fc9867", "#ffd866", "#a9dc76", "#ab9df2"]
    }
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    mode: "dark",
    swatch: {
      bg: "#1a1b26",
      surface: "#24283b",
      text: "#c0caf5",
      accent: "#7aa2f7",
      hues: ["#f7768e", "#ff9e64", "#9ece6a", "#7dcfff", "#bb9af7"]
    }
  },
  {
    id: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    mode: "dark",
    swatch: {
      bg: "#1e1e2e",
      surface: "#313244",
      text: "#cdd6f4",
      accent: "#cba6f7",
      hues: ["#f38ba8", "#fab387", "#a6e3a1", "#89b4fa", "#f5c2e7"]
    }
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    mode: "dark",
    swatch: {
      bg: "#0d1117",
      surface: "#161b22",
      text: "#c9d1d9",
      accent: "#58a6ff",
      hues: ["#f85149", "#db6d28", "#3fb950", "#56d4dd", "#bc8cff"]
    }
  },
  {
    id: "light",
    label: "Default Light",
    mode: "light",
    swatch: {
      bg: "#eef1f4",
      surface: "#ffffff",
      text: "#1f2328",
      accent: "#0969da",
      hues: ["#cf222e", "#bc4c00", "#1a7f37", "#1b7c83", "#8250df"]
    }
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    mode: "light",
    swatch: {
      bg: "#fdf6e3",
      surface: "#eee8d5",
      text: "#586e75",
      accent: "#268bd2",
      hues: ["#dc322f", "#cb4b16", "#859900", "#2aa198", "#6c71c4"]
    }
  },
  {
    id: "gruvbox-light",
    label: "Gruvbox Light",
    mode: "light",
    swatch: {
      bg: "#fbf1c7",
      surface: "#ebdbb2",
      text: "#3c3836",
      accent: "#af3a03",
      hues: ["#9d0006", "#b57614", "#79740e", "#076678", "#8f3f71"]
    }
  },
  {
    id: "catppuccin-latte",
    label: "Catppuccin Latte",
    mode: "light",
    swatch: {
      bg: "#eff1f5",
      surface: "#e6e9ef",
      text: "#4c4f69",
      accent: "#1e66f5",
      hues: ["#d20f39", "#fe640b", "#40a02b", "#179299", "#8839ef"]
    }
  },
  {
    id: "github-light",
    label: "GitHub Light",
    mode: "light",
    swatch: {
      bg: "#f6f8fa",
      surface: "#ffffff",
      text: "#1f2328",
      accent: "#0969da",
      hues: ["#cf222e", "#bc4c00", "#1a7f37", "#1b7c83", "#8250df"]
    }
  }
];

// src/panelTokens.ts
var PANEL_TOKENS_CSS = `:root {
  --agentry-color-bg-app: #0b0d10;
  --agentry-color-bg-base: #101317;
  --agentry-color-bg-surface: #161a20;
  --agentry-color-bg-elevated: #1c2128;
  --agentry-color-bg-inset: #0d1014;
  --agentry-color-minimap-node: #3b82f6;
  --agentry-color-minimap-node-border: #1d4ed8;
  --agentry-color-minimap-label: #ffffff;
  --agentry-color-minimap-edge: #c4ced9;
  --agentry-color-minimap-viewport-fill: color-mix(in srgb, var(--agentry-color-accent) 12%, transparent);
  --agentry-color-minimap-viewport-border: var(--agentry-color-accent);
  --agentry-color-border-subtle: #21262d;
  --agentry-color-border-default: #2d333b;
  --agentry-color-border-strong: #3d444d;
  --agentry-color-text-primary: #e6edf3;
  --agentry-color-text-secondary: #9da7b3;
  --agentry-color-text-muted: #6e7681;
  --agentry-color-accent: #4d9eff;
  --agentry-color-accent-hover: #6cb0ff;
  --agentry-color-accent-ink: #06121f;
  --agentry-color-accent-muted: color-mix(in srgb, var(--agentry-color-accent) 14%, transparent);
  --agentry-color-type-straight: #4d9eff;
  --agentry-color-type-reporter: #bc8cff;
  --agentry-color-type-branch: #f0883e;
  --agentry-color-type-subworkflow: #39c5cf;
  --agentry-color-type-input: #3fb950;
  --agentry-color-type-output: #f778ba;
  --agentry-color-type-documenter: color-mix(in srgb, var(--agentry-color-type-reporter) 60%, var(--agentry-color-type-subworkflow));
  --agentry-color-type-tool: color-mix(in srgb, var(--agentry-color-type-straight) 45%, var(--agentry-color-text-secondary));
  --agentry-color-type-decision: color-mix(in srgb, var(--agentry-color-type-branch) 55%, var(--agentry-color-text-secondary));
  --agentry-state-done: #3fb950;
  --agentry-state-running: #e3b341;
  --agentry-state-pending: #6e7681;
  --agentry-state-failed: #f85149;
  --agentry-state-done-soft: color-mix(in srgb, var(--agentry-state-done) 16%, transparent);
  --agentry-state-running-soft: color-mix(in srgb, var(--agentry-state-running) 18%, transparent);
  --agentry-state-pending-soft: color-mix(in srgb, var(--agentry-state-pending) 16%, transparent);
  --agentry-state-failed-soft: color-mix(in srgb, var(--agentry-state-failed) 16%, transparent);
  --agentry-state-skipped: color-mix(in srgb, var(--agentry-state-pending) 55%, transparent);
  --agentry-state-skipped-soft: color-mix(in srgb, var(--agentry-state-pending) 10%, transparent);
  --agentry-font-sans: 'Geist', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --agentry-font-mono: 'Geist Mono', 'JetBrains Mono', 'Cascadia Mono', Consolas, ui-monospace, 'SFMono-Regular', monospace;
  --agentry-fs-xs: 11px;
  --agentry-fs-sm: 12px;
  --agentry-fs-base: 13px;
  --agentry-fs-md: 14px;
  --agentry-fs-lg: 16px;
  --agentry-fs-xl: 18px;
  --agentry-fs-xxl: 22px;
  --agentry-fw-regular: 400;
  --agentry-fw-medium: 500;
  --agentry-fw-semibold: 600;
  --agentry-fw-bold: 700;
  --agentry-space-xs: 2px;
  --agentry-space-sm: 4px;
  --agentry-space-md: 6px;
  --agentry-space-base: 8px;
  --agentry-space-lg: 12px;
  --agentry-space-xl: 16px;
  --agentry-space-xxl: 20px;
  --agentry-space-xxxl: 24px;
  --agentry-space-huge: 32px;
  --agentry-radius-sm: 4px;
  --agentry-radius-md: 6px;
  --agentry-radius-lg: 8px;
  --agentry-radius-xl: 12px;
  --agentry-radius-pill: 999px;
  --agentry-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --agentry-shadow-md: 0 4px 14px rgba(0, 0, 0, 0.45);
  --agentry-shadow-lg: 0 14px 36px rgba(0, 0, 0, 0.55);
  --agentry-shadow-glow: 0 0 0 1px color-mix(in srgb, var(--agentry-color-accent) 45%, transparent), 0 0 20px color-mix(in srgb, var(--agentry-color-accent) 22%, transparent);
  --agentry-lens-bg: color-mix(in srgb, var(--agentry-color-bg-surface) 50%, transparent);
  --agentry-lens-rim: color-mix(in srgb, var(--agentry-color-text-primary) 16%, transparent);
  --agentry-lens-sheen: rgba(255, 255, 255, 0.05);
  --agentry-lens-shadow: 0 18px 50px rgba(0, 0, 0, 0.62);
  --agentry-scrollbar-thumb: color-mix(in srgb, var(--agentry-color-text-primary) 14%, transparent);
  --agentry-scrollbar-thumb-hover: color-mix(in srgb, var(--agentry-color-text-primary) 26%, transparent);
}
:root[data-mode='light'] {
  --agentry-shadow-sm: 0 1px 2px rgba(31, 35, 40, 0.1);
  --agentry-shadow-md: 0 4px 14px rgba(31, 35, 40, 0.1);
  --agentry-shadow-lg: 0 14px 36px rgba(31, 35, 40, 0.14);
  --agentry-lens-sheen: rgba(255, 255, 255, 0.75);
  --agentry-lens-shadow: 0 18px 50px rgba(31, 35, 40, 0.2);
}
:root[data-theme='light'] {
  --agentry-color-bg-app: #eef1f4;
  --agentry-color-bg-base: #f6f8fa;
  --agentry-color-bg-surface: #ffffff;
  --agentry-color-bg-elevated: #ffffff;
  --agentry-color-bg-inset: #f0f3f6;
  --agentry-color-minimap-edge: #0b0f14;
  --agentry-color-border-subtle: #e4e8ec;
  --agentry-color-border-default: #d0d7de;
  --agentry-color-border-strong: #b3bcc5;
  --agentry-color-text-primary: #1f2328;
  --agentry-color-text-secondary: #57606a;
  --agentry-color-text-muted: #818b98;
  --agentry-color-accent: #0969da;
  --agentry-color-accent-hover: #1a7fea;
  --agentry-color-accent-ink: #ffffff;
  --agentry-color-type-straight: #0969da;
  --agentry-color-type-reporter: #8250df;
  --agentry-color-type-branch: #bc4c00;
  --agentry-color-type-subworkflow: #1b7c83;
  --agentry-color-type-input: #1a7f37;
  --agentry-color-type-output: #bf3989;
  --agentry-state-done: #1a7f37;
  --agentry-state-running: #bf8700;
  --agentry-state-pending: #818b98;
  --agentry-state-failed: #cf222e;
}
:root[data-theme='dracula'] {
  --agentry-color-bg-app: #282a36;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #44475a;
  --agentry-color-bg-elevated: color-mix(in srgb, var(--agentry-color-bg-surface) 88%, white);
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #f8f8f2;
  --agentry-color-text-secondary: color-mix(in srgb, var(--agentry-color-text-primary) 55%, var(--agentry-color-text-muted));
  --agentry-color-text-muted: #6272a4;
  --agentry-color-accent: #bd93f9;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #282a36;
  --agentry-color-type-straight: #8be9fd;
  --agentry-color-type-reporter: #bd93f9;
  --agentry-color-type-branch: #ffb86c;
  --agentry-color-type-subworkflow: #8be9fd;
  --agentry-color-type-input: #50fa7b;
  --agentry-color-type-output: #ff79c6;
  --agentry-state-done: #50fa7b;
  --agentry-state-running: #f1fa8c;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #ff5555;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='nord'] {
  --agentry-color-bg-app: #2e3440;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #3b4252;
  --agentry-color-bg-elevated: color-mix(in srgb, var(--agentry-color-bg-surface) 88%, white);
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #eceff4;
  --agentry-color-text-secondary: #d8dee9;
  --agentry-color-text-muted: #616e88;
  --agentry-color-accent: #88c0d0;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #2e3440;
  --agentry-color-type-straight: #81a1c1;
  --agentry-color-type-reporter: #b48ead;
  --agentry-color-type-branch: #d08770;
  --agentry-color-type-subworkflow: #88c0d0;
  --agentry-color-type-input: #a3be8c;
  --agentry-color-type-output: #b48ead;
  --agentry-state-done: #a3be8c;
  --agentry-state-running: #ebcb8b;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #bf616a;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='solarized-dark'] {
  --agentry-color-bg-app: #002b36;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #073642;
  --agentry-color-bg-elevated: color-mix(in srgb, var(--agentry-color-bg-surface) 88%, white);
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #93a1a1;
  --agentry-color-text-secondary: #839496;
  --agentry-color-text-muted: #586e75;
  --agentry-color-accent: #268bd2;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #002b36;
  --agentry-color-type-straight: #268bd2;
  --agentry-color-type-reporter: #6c71c4;
  --agentry-color-type-branch: #cb4b16;
  --agentry-color-type-subworkflow: #2aa198;
  --agentry-color-type-input: #859900;
  --agentry-color-type-output: #d33682;
  --agentry-state-done: #859900;
  --agentry-state-running: #b58900;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #dc322f;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='gruvbox-dark'] {
  --agentry-color-bg-app: #282828;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #3c3836;
  --agentry-color-bg-elevated: color-mix(in srgb, var(--agentry-color-bg-surface) 88%, white);
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #ebdbb2;
  --agentry-color-text-secondary: #d5c4a1;
  --agentry-color-text-muted: #928374;
  --agentry-color-accent: #fe8019;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #282828;
  --agentry-color-type-straight: #83a598;
  --agentry-color-type-reporter: #d3869b;
  --agentry-color-type-branch: #fe8019;
  --agentry-color-type-subworkflow: #8ec07c;
  --agentry-color-type-input: #b8bb26;
  --agentry-color-type-output: #d3869b;
  --agentry-state-done: #b8bb26;
  --agentry-state-running: #fabd2f;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #fb4934;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='one-dark'] {
  --agentry-color-bg-app: #282c34;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #3e4451;
  --agentry-color-bg-elevated: color-mix(in srgb, var(--agentry-color-bg-surface) 88%, white);
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #abb2bf;
  --agentry-color-text-secondary: #9da5b4;
  --agentry-color-text-muted: #5c6370;
  --agentry-color-accent: #61afef;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #282c34;
  --agentry-color-type-straight: #61afef;
  --agentry-color-type-reporter: #c678dd;
  --agentry-color-type-branch: #d19a66;
  --agentry-color-type-subworkflow: #56b6c2;
  --agentry-color-type-input: #98c379;
  --agentry-color-type-output: #e06c75;
  --agentry-state-done: #98c379;
  --agentry-state-running: #e5c07b;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #e06c75;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='monokai'] {
  --agentry-color-bg-app: #2d2a2e;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #3e3b37;
  --agentry-color-bg-elevated: color-mix(in srgb, var(--agentry-color-bg-surface) 88%, white);
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #fcfcfa;
  --agentry-color-text-secondary: #c1c0c0;
  --agentry-color-text-muted: #727072;
  --agentry-color-accent: #78dce8;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #2d2a2e;
  --agentry-color-type-straight: #78dce8;
  --agentry-color-type-reporter: #ab9df2;
  --agentry-color-type-branch: #fc9867;
  --agentry-color-type-subworkflow: #78dce8;
  --agentry-color-type-input: #a9dc76;
  --agentry-color-type-output: #ff6188;
  --agentry-state-done: #a9dc76;
  --agentry-state-running: #ffd866;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #ff6188;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='tokyo-night'] {
  --agentry-color-bg-app: #1a1b26;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #24283b;
  --agentry-color-bg-elevated: #414868;
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #c0caf5;
  --agentry-color-text-secondary: #a9b1d6;
  --agentry-color-text-muted: #565f89;
  --agentry-color-accent: #7aa2f7;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #1a1b26;
  --agentry-color-type-straight: #7aa2f7;
  --agentry-color-type-reporter: #bb9af7;
  --agentry-color-type-branch: #ff9e64;
  --agentry-color-type-subworkflow: #7dcfff;
  --agentry-color-type-input: #9ece6a;
  --agentry-color-type-output: #bb9af7;
  --agentry-state-done: #9ece6a;
  --agentry-state-running: #e0af68;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #f7768e;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='catppuccin-mocha'] {
  --agentry-color-bg-app: #1e1e2e;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #313244;
  --agentry-color-bg-elevated: #45475a;
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #cdd6f4;
  --agentry-color-text-secondary: #bac2de;
  --agentry-color-text-muted: #6c7086;
  --agentry-color-accent: #cba6f7;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #1e1e2e;
  --agentry-color-type-straight: #89b4fa;
  --agentry-color-type-reporter: #cba6f7;
  --agentry-color-type-branch: #fab387;
  --agentry-color-type-subworkflow: #94e2d5;
  --agentry-color-type-input: #a6e3a1;
  --agentry-color-type-output: #f5c2e7;
  --agentry-state-done: #a6e3a1;
  --agentry-state-running: #f9e2af;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #f38ba8;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='github-dark'] {
  --agentry-color-bg-app: #0d1117;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #161b22;
  --agentry-color-bg-elevated: #21262d;
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 90%, black);
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #c9d1d9;
  --agentry-color-text-secondary: #a5adb8;
  --agentry-color-text-muted: #8b949e;
  --agentry-color-accent: #58a6ff;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 82%, white);
  --agentry-color-accent-ink: #0d1117;
  --agentry-color-type-straight: #58a6ff;
  --agentry-color-type-reporter: #bc8cff;
  --agentry-color-type-branch: #db6d28;
  --agentry-color-type-subworkflow: #56d4dd;
  --agentry-color-type-input: #3fb950;
  --agentry-color-type-output: #f778ba;
  --agentry-state-done: #3fb950;
  --agentry-state-running: #d29922;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #f85149;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='solarized-light'] {
  --agentry-color-bg-app: #fdf6e3;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #eee8d5;
  --agentry-color-bg-elevated: #fffcf2;
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 96%, var(--agentry-color-text-primary));
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #586e75;
  --agentry-color-text-secondary: #657b83;
  --agentry-color-text-muted: #93a1a1;
  --agentry-color-accent: #268bd2;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 86%, black);
  --agentry-color-accent-ink: #fdf6e3;
  --agentry-color-type-straight: #268bd2;
  --agentry-color-type-reporter: #6c71c4;
  --agentry-color-type-branch: #cb4b16;
  --agentry-color-type-subworkflow: #2aa198;
  --agentry-color-type-input: #859900;
  --agentry-color-type-output: #d33682;
  --agentry-state-done: #859900;
  --agentry-state-running: #b58900;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #dc322f;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='gruvbox-light'] {
  --agentry-color-bg-app: #fbf1c7;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #ebdbb2;
  --agentry-color-bg-elevated: color-mix(in srgb, var(--agentry-color-bg-surface) 55%, white);
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 96%, var(--agentry-color-text-primary));
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #3c3836;
  --agentry-color-text-secondary: #504945;
  --agentry-color-text-muted: #7c6f64;
  --agentry-color-accent: #af3a03;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 86%, black);
  --agentry-color-accent-ink: #fbf1c7;
  --agentry-color-type-straight: #076678;
  --agentry-color-type-reporter: #8f3f71;
  --agentry-color-type-branch: #af3a03;
  --agentry-color-type-subworkflow: #427b58;
  --agentry-color-type-input: #79740e;
  --agentry-color-type-output: #8f3f71;
  --agentry-state-done: #79740e;
  --agentry-state-running: #b57614;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #9d0006;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='catppuccin-latte'] {
  --agentry-color-bg-app: #eff1f5;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #e6e9ef;
  --agentry-color-bg-elevated: #ffffff;
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 96%, var(--agentry-color-text-primary));
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #4c4f69;
  --agentry-color-text-secondary: #5c5f77;
  --agentry-color-text-muted: #8c8fa1;
  --agentry-color-accent: #1e66f5;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 86%, black);
  --agentry-color-accent-ink: #ffffff;
  --agentry-color-type-straight: #1e66f5;
  --agentry-color-type-reporter: #8839ef;
  --agentry-color-type-branch: #fe640b;
  --agentry-color-type-subworkflow: #179299;
  --agentry-color-type-input: #40a02b;
  --agentry-color-type-output: #ea76cb;
  --agentry-state-done: #40a02b;
  --agentry-state-running: #df8e1d;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #d20f39;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}
:root[data-theme='github-light'] {
  --agentry-color-bg-app: #f6f8fa;
  --agentry-color-bg-base: color-mix(in srgb, var(--agentry-color-bg-app) 50%, var(--agentry-color-bg-surface));
  --agentry-color-bg-surface: #ffffff;
  --agentry-color-bg-elevated: #ffffff;
  --agentry-color-bg-inset: color-mix(in srgb, var(--agentry-color-bg-app) 96%, var(--agentry-color-text-primary));
  --agentry-color-border-subtle: color-mix(in srgb, var(--agentry-color-bg-surface) 92%, var(--agentry-color-text-primary));
  --agentry-color-border-default: color-mix(in srgb, var(--agentry-color-bg-surface) 84%, var(--agentry-color-text-primary));
  --agentry-color-border-strong: color-mix(in srgb, var(--agentry-color-bg-surface) 72%, var(--agentry-color-text-primary));
  --agentry-color-text-primary: #1f2328;
  --agentry-color-text-secondary: #57606a;
  --agentry-color-text-muted: #818b98;
  --agentry-color-accent: #0969da;
  --agentry-color-accent-hover: color-mix(in srgb, var(--agentry-color-accent) 86%, black);
  --agentry-color-accent-ink: #ffffff;
  --agentry-color-type-straight: #0969da;
  --agentry-color-type-reporter: #8250df;
  --agentry-color-type-branch: #bc4c00;
  --agentry-color-type-subworkflow: #1b7c83;
  --agentry-color-type-input: #1a7f37;
  --agentry-color-type-output: #bf3989;
  --agentry-state-done: #1a7f37;
  --agentry-state-running: #9e6a03;
  --agentry-state-pending: var(--agentry-color-text-muted);
  --agentry-state-failed: #cf222e;
  --agentry-color-minimap-node: var(--agentry-color-accent);
  --agentry-color-minimap-node-border: color-mix(in srgb, var(--agentry-color-accent) 70%, black);
  --agentry-color-minimap-edge: color-mix(in srgb, var(--agentry-color-text-primary) 65%, transparent);
  --agentry-color-minimap-label: var(--agentry-color-text-primary);
}`;

// src/tools.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
var READ_LIMIT = 2 * 1024 * 1024;
var HTTP_BODY_LIMIT = 256 * 1024;
var PIPE_LIMIT = 64 * 1024;
var ToolError = class extends Error {
  constructor(message, resolved = [], notices = []) {
    super(message);
    this.resolved = resolved;
    this.notices = notices;
    this.name = "ToolError";
  }
};
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var errorMessage = (err) => err instanceof Error ? err.message : String(err);
function resolveInside(projectDir, rel, what) {
  const root = fs.realpathSync.native(projectDir);
  const abs = path.resolve(root, rel);
  const escapes = (candidate) => {
    const between = path.relative(root, candidate);
    return between === ".." || between.startsWith(`..${path.sep}`) || path.isAbsolute(between);
  };
  if (escapes(abs)) throw new ToolError(`${what} "${rel}" escapes the project directory`);
  let probe = abs;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  if (escapes(fs.realpathSync.native(probe))) throw new ToolError(`${what} "${rel}" resolves outside the project directory (symlink)`);
  return abs;
}
var projectPath = (projectDir, abs) => path.relative(fs.realpathSync.native(projectDir), abs).split(path.sep).join("/");
var clipPipe = (text, limit) => text.length > limit ? `${text.slice(0, limit)}
…[truncated: ${text.length - limit} more characters]` : text;
function render(text, scope, notices) {
  const out = renderTemplate(text, scope);
  notices.push(...out.notices);
  return out.text;
}
async function runHttp(spec, scope) {
  const notices = [];
  const url = renderUrl(spec.url, scope);
  notices.push(...url.notices);
  const method = spec.method ?? "GET";
  const headers = {};
  for (const [key, value] of Object.entries(spec.headers ?? {})) headers[key] = render(value, scope, notices);
  let body;
  if (typeof spec.body === "string") body = render(spec.body, scope, notices);
  else if (spec.body) {
    const mapped = {};
    for (const [key, value] of Object.entries(spec.body)) mapped[key] = typeof value === "string" ? render(value, scope, notices) : value;
    body = JSON.stringify(mapped);
    if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json";
  }
  const resolved = [`${method} ${url.text}`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), ...body !== void 0 ? ["", body] : []];
  const timeoutMs = (spec.timeout_s ?? HTTP_TIMEOUT_S) * 1e3;
  let response;
  try {
    response = await fetch(url.text, { method, headers, body, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? `timed out after ${timeoutMs / 1e3} s` : errorMessage(err);
    throw new ToolError(`${method} ${url.text} failed: ${reason}`, resolved, notices);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let parsed = text;
  if (/json/i.test(contentType)) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (typeof parsed === "string") parsed = clipPipe(parsed, HTTP_BODY_LIMIT);
  const output = JSON.stringify({ status: response.status, ok: response.ok, content_type: contentType, body: parsed });
  if (!response.ok && !spec.allow_failure) throw new ToolError(`${method} ${url.text} answered ${response.status} ${response.statusText}`.trim(), [...resolved, "", `→ ${response.status}`], notices);
  return { output, resolved: [...resolved, "", `→ ${response.status} ${contentType}`.trim()], notices };
}
function runReadFile(spec, scope, projectDir) {
  const notices = [];
  const rel = render(spec.path, scope, notices);
  const abs = resolveInside(projectDir, rel, "path");
  const resolved = [`read ${abs}`];
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    throw new ToolError(`path "${rel}" does not exist`, resolved, notices);
  }
  if (!stat.isFile()) throw new ToolError(`path "${rel}" is not a file`, resolved, notices);
  if (stat.size > READ_LIMIT) throw new ToolError(`path "${rel}" is ${stat.size} bytes; read_file reads at most ${READ_LIMIT}`, resolved, notices);
  const content = fs.readFileSync(abs, "utf-8");
  const record = { path: projectPath(projectDir, abs), bytes: stat.size, content };
  try {
    record.json = JSON.parse(content);
  } catch {
  }
  return { output: JSON.stringify(record), resolved, notices };
}
function runWriteFile(spec, scope, projectDir) {
  const notices = [];
  const rel = render(spec.path, scope, notices);
  const abs = resolveInside(projectDir, rel, "path");
  const first = scope.sources[0];
  const content = spec.content !== void 0 ? render(spec.content, scope, notices) : (first !== void 0 ? scope.outputs.get(first) : void 0) ?? scope.input ?? "";
  const mode = spec.mode ?? "overwrite";
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (mode === "append") fs.appendFileSync(abs, content);
  else fs.writeFileSync(abs, content);
  const bytes = Buffer.byteLength(content);
  return {
    output: JSON.stringify({ path: projectPath(projectDir, abs), bytes, mode }),
    resolved: [`${mode} ${abs} (${bytes} bytes)`],
    notices
  };
}
function killTree(child) {
  if (child.pid === void 0) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true }).on("error", () => child.kill());
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}
function collect(stream, sink) {
  stream?.setEncoding("utf-8");
  stream?.on("data", (chunk) => {
    if (sink.text.length <= PIPE_LIMIT * 2) sink.text += chunk;
  });
}
function scriptStdin(scope) {
  const upstream = {};
  for (const id of scope.sources) {
    const text = scope.outputs.get(id);
    if (text === void 0) continue;
    upstream[id] = extractJson(text) ?? text;
  }
  return JSON.stringify({ input: scope.input ?? null, upstream });
}
function runScript(run, spec) {
  const { scope, projectDir, runDir, nodeId } = run;
  const notices = [];
  const cwd = spec.cwd ? resolveInside(projectDir, render(spec.cwd, scope, notices), "cwd") : projectDir;
  const stdin = scriptStdin(scope);
  const inputFile = path.join(runDir, `${nodeId}.input.json`);
  fs.writeFileSync(inputFile, stdin);
  const env = { ...process.env, AGENTRY_INPUT_FILE: inputFile, AGENTRY_RUN_DIR: runDir };
  const timeoutMs = (spec.timeout_s ?? SCRIPT_TIMEOUT_S) * 1e3;
  const common = { cwd, env, stdio: "pipe", windowsHide: true, detached: process.platform !== "win32" };
  let child;
  let resolved;
  if (Array.isArray(spec.command)) {
    const argv = spec.command.map((arg) => render(String(arg), scope, notices));
    const [exe, ...args] = argv;
    if (exe === void 0) throw new ToolError("script.command is empty", [], notices);
    resolved = [`$ ${argv.map((a) => /\s/.test(a) ? JSON.stringify(a) : a).join(" ")}`, `cwd: ${cwd}`];
    child = spawn(exe, args, common);
  } else {
    resolved = [`$ ${spec.command}`, `cwd: ${cwd}`, "(shell command — not templated)"];
    child = spawn(spec.command, { ...common, shell: true });
  }
  return new Promise((resolve3, reject) => {
    const out = { text: "" };
    const err = { text: "" };
    collect(child.stdout, out);
    collect(child.stderr, err);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.on("error", (spawnErr) => {
      clearTimeout(timer);
      reject(new ToolError(`script failed to start: ${spawnErr.message}`, resolved, notices));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const stdout = clipPipe(out.text, PIPE_LIMIT);
      const stderr = clipPipe(err.text, PIPE_LIMIT);
      if (timedOut) {
        reject(new ToolError(`script timed out after ${timeoutMs / 1e3} s (process tree killed)`, [...resolved, "", `stderr: ${stderr}`], notices));
        return;
      }
      const exitCode = code ?? -1;
      const record = { exit_code: exitCode, stdout, stderr };
      let parsed;
      try {
        parsed = JSON.parse(out.text.trim());
      } catch {
        parsed = void 0;
      }
      if (isObj(parsed)) record.result = parsed;
      const output = JSON.stringify(record);
      const summary = [...resolved, "", `→ exit ${exitCode}${signal ? ` (${signal})` : ""}`];
      if (exitCode !== 0 && !spec.allow_failure) {
        reject(new ToolError(`script exited with ${exitCode}${signal ? ` (${signal})` : ""}${stderr ? `: ${stderr.trim().split("\n").slice(-3).join(" | ")}` : ""}`, summary, notices));
        return;
      }
      resolve3({ output, resolved: summary, notices });
    });
    child.stdin?.on("error", () => {
    });
    child.stdin?.end(stdin);
  });
}
async function runTool(run) {
  const { spec, scope, projectDir } = run;
  switch (spec.kind) {
    case "http":
      return runHttp(spec, scope);
    case "read_file":
      return runReadFile(spec, scope, projectDir);
    case "write_file":
      return runWriteFile(spec, scope, projectDir);
    case "script":
      return runScript(run, spec);
  }
}

// src/decision.ts
var TYPESAFE_DEFAULT_URL = "https://api.typesafe.ai";
var JEV_TIMEOUT_MS = 6e4;
var JEV_ATTEMPTS = 3;
var JEV_BACKOFF_MS = 500;
var RETRY_STATUSES = /* @__PURE__ */ new Set([429, 529]);
var JEV_CONCURRENCY = 4;
var LLM_CONCURRENCY = 2;
function pickBackend(env) {
  const forced = env.AGENTRY_DECISION_BACKEND?.trim().toLowerCase();
  if (forced === "llm") return "llm";
  if (forced === "jev") return "jev";
  return env.TYPESAFE_API_KEY?.trim() ? "jev" : "llm";
}
var DecisionError = class extends Error {
  constructor(message, resolved = []) {
    super(message);
    this.resolved = resolved;
    this.name = "DecisionError";
  }
};
var sleep = (ms) => new Promise((resolve3) => setTimeout(resolve3, ms));
async function mapLimited(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
function buildJevCall(req) {
  const base = (req.env.TYPESAFE_BASE_URL?.trim() || TYPESAFE_DEFAULT_URL).replace(/\/+$/, "");
  const model = req.spec.model?.trim() || DECISION_DEFAULT_MODEL;
  const body = JSON.stringify({ state: req.state, model, questions: toJevQuestions(req.spec) });
  return { url: `${base}/v1/systemone`, model, body };
}
async function askJev(req) {
  const key = req.env.TYPESAFE_API_KEY?.trim();
  if (!key) throw new DecisionError("TYPESAFE_API_KEY is not set (AGENTRY_DECISION_BACKEND=jev needs a key)");
  const call = buildJevCall(req);
  const resolved = [`POST ${call.url}`, `model: ${call.model}`, "", call.body];
  const doFetch = req.fetchImpl ?? fetch;
  const backoff = req.backoffMs ?? JEV_BACKOFF_MS;
  for (let attempt = 1; ; attempt += 1) {
    let response;
    try {
      response = await doFetch(call.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: call.body,
        signal: AbortSignal.timeout(JEV_TIMEOUT_MS)
      });
    } catch (err) {
      const reason = err instanceof Error && err.name === "TimeoutError" ? `timed out after ${JEV_TIMEOUT_MS / 1e3} s` : err instanceof Error ? err.message : String(err);
      throw new DecisionError(`POST ${call.url} failed: ${reason}`, resolved);
    }
    const text = await response.text();
    if (RETRY_STATUSES.has(response.status) && attempt < JEV_ATTEMPTS) {
      resolved.push(`→ ${response.status} (retry ${attempt}/${JEV_ATTEMPTS - 1})`);
      await sleep(backoff * 2 ** (attempt - 1));
      continue;
    }
    if (!response.ok) throw new DecisionError(`POST ${call.url} answered ${response.status}: ${text.slice(0, 500)}`, [...resolved, "", `→ ${response.status}`]);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new DecisionError(`POST ${call.url} answered non-JSON: ${text.slice(0, 200)}`, resolved);
    }
    const record = typeof parsed === "object" && parsed !== null ? parsed : {};
    try {
      const answers = fromJevAnswers(req.spec, record.answers);
      const model = typeof record.model === "string" ? record.model : call.model;
      return { answers, model, resolved: [...resolved, "", `→ ${response.status} ${model}`] };
    } catch (err) {
      throw new DecisionError(err instanceof Error ? err.message : String(err), [...resolved, "", text.slice(0, 2e3)]);
    }
  }
}
async function askLlm(spec, state, ask) {
  const prompt = decisionPrompt(spec, state);
  const first = await ask(prompt);
  try {
    return { answers: parseLlmAnswers(spec, first), resolved: ["## Prompt", prompt, "", "## Reply", first] };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const second = await ask(`Your previous reply was not usable (${reason}). ${prompt.slice(prompt.lastIndexOf("Respond with ONLY"))}
Your prior reply was:
${first}`);
    try {
      return { answers: parseLlmAnswers(spec, second), resolved: ["## Prompt", prompt, "", "## Reply (first, unusable)", first, "", "## Reply", second] };
    } catch (retryErr) {
      throw new DecisionError(retryErr instanceof Error ? retryErr.message : String(retryErr), ["## Prompt", prompt, "", "## Reply", first, "", "## Reply (repair)", second]);
    }
  }
}

// src/agentry.ts
var PANEL_FILE = ".agentry/panel.json";
var REPORT_FILE = "log.md";
function extractText(parts) {
  if (!Array.isArray(parts)) return "";
  return parts.filter((p) => typeof p === "object" && p !== null && "type" in p).filter((p) => p.type === "text").map((p) => p.text ?? p.content ?? "").join("\n").trim();
}
function isObj2(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var ts = () => (/* @__PURE__ */ new Date()).toISOString();
var errorMessage2 = (err) => err instanceof Error ? err.message : String(err);
var fmtMs = (ms) => ms < 1e3 ? `${ms} ms` : `${(ms / 1e3).toFixed(1)} s`;
var clip = (text, max) => text.length > max ? `${text.slice(0, max)}…` : text;
var runtime = "opencode";
var READ_ONLY_ROLES = /* @__PURE__ */ new Set(["explore", "plan"]);
var host = null;
function log(level, message) {
  void host?.app.log?.({ body: { service: "agentry", level, message: `[agentry] ${message}` } })?.catch(() => {
  });
}
function buildDag(wf) {
  const parents = branchParents(wf);
  const nodes = /* @__PURE__ */ new Map();
  for (const [id, def] of Object.entries(wf.agents)) {
    const bp = parents.get(id) ?? [];
    const sources = inputSources(def, bp);
    const upstream = [...sources];
    const gate = def.trigger?.when?.from;
    if (gate && !upstream.includes(gate)) upstream.push(gate);
    const node = { id, def, upstream, sources, branchParents: bp };
    const feedback = def.input?.feedback;
    if (feedback) {
      const body = feedbackLoopBody(wf, id);
      if (!body) throw new Error(`"${id}" loops back from "${feedback.from}", which is not downstream of it`);
      node.loop = { from: feedback.from, when: feedback.when, max: feedback.max ?? FEEDBACK_DEFAULT_MAX, body };
    }
    nodes.set(id, node);
  }
  for (const node of nodes.values()) {
    if (node.def.type !== "documenter") continue;
    for (const other of nodes.keys()) if (other !== node.id && !node.upstream.includes(other)) node.upstream.push(other);
  }
  for (const [id, node] of nodes) {
    for (const dep of node.upstream) if (!nodes.has(dep)) throw new Error(`"${id}" depends on "${dep}" which doesn't exist`);
  }
  for (const id of wf.workflow) if (!nodes.has(id)) throw new Error(`workflow[] references unknown "${id}"`);
  return { nodes, order: wf.workflow };
}
var agentCache = null;
async function resolveAgent(client, target) {
  if (!agentCache) {
    try {
      const resp = await client.app.agents();
      agentCache = resp.data ?? [];
    } catch {
      return target;
    }
  }
  if (agentCache.some((a) => a.name === target)) return target;
  const avail = agentCache.map((a) => a.name).join(", ");
  throw new Error(`Agent "${target}" not available. Available: [${avail}]`);
}
function loadCheckpoint(runDir) {
  const p = path2.join(runDir, CHECKPOINT_FILE);
  if (!fs2.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs2.readFileSync(p, "utf-8"));
    return isObj2(parsed) && Array.isArray(parsed.completed) ? parsed : null;
  } catch {
    return null;
  }
}
function saveCheckpoint(runDir, cp) {
  fs2.writeFileSync(path2.join(runDir, CHECKPOINT_FILE), JSON.stringify(cp, null, 2));
}
function validateOutput(nodeId, outputText, schema) {
  if (!schema || Object.keys(schema).length === 0) return [];
  const warnings = [];
  try {
    const parsed = JSON.parse(stripJsonFences(outputText));
    if (!isObj2(parsed)) {
      warnings.push(`${nodeId}: output is not a JSON object`);
      return warnings;
    }
    for (const key of Object.keys(schema)) {
      if (!(key in parsed)) warnings.push(`${nodeId}: missing expected key "${key}"`);
    }
  } catch {
    warnings.push(`${nodeId}: output is not valid JSON (schema check skipped)`);
  }
  return warnings;
}
function gateUnmet(def, outputs, skipped) {
  const when = def.trigger?.when;
  if (!when?.from) return false;
  if (skipped.has(when.from)) return true;
  const upstreamOutput = outputs.get(when.from);
  if (!upstreamOutput) return false;
  return !matchesCondition(upstreamOutput, when);
}
function branchSkipReason(node, seed, skipped) {
  if (seed.has(node.id)) return "branch route not chosen";
  const gate = node.def.trigger?.when?.from;
  if (gate && seed.has(gate)) return `gate "${gate}" was skipped`;
  if (joinMode(node.def) === "any") {
    const starved = node.sources.length > 0 && node.sources.every((s) => seed.has(s) || skipped.has(s));
    return starved ? "every upstream was skipped (join: any)" : null;
  }
  if (fromList(node.def.input?.from).some((f) => seed.has(f))) return "an upstream was skipped by a branch";
  if (node.branchParents.length > 0 && node.branchParents.every((b) => seed.has(b))) return "branch route not chosen";
  return null;
}
function findDownstream(nodeId, dag) {
  const result = /* @__PURE__ */ new Set();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const [id, node] of dag.nodes) {
      if (result.has(id)) continue;
      if (node.upstream.includes(current)) {
        result.add(id);
        queue.push(id);
      }
    }
  }
  return result;
}
var sseClients = /* @__PURE__ */ new Set();
var panelPageClients = /* @__PURE__ */ new Set();
var sseReplayBuffer = [];
var panelServer = null;
var panelPort = 0;
var runToken = "";
var runHost = null;
var runInProgress = false;
var abortFlag = false;
var rerunNodeId = null;
var lastClient = null;
var lastDirectory = "";
var lastWorkflow = null;
var lastRunId = "";
var designTokensCss = "";
var panelFilePath = "";
var panelExitHooked = false;
var PANEL_THEMES = THEMES.map((t) => ({ id: t.id, label: t.label, mode: t.mode }));
var panelTheme = "dark";
var panelLastByMode = { dark: "dark", light: "light" };
function setPanelTheme(id) {
  const def = PANEL_THEMES.find((t) => t.id === id);
  if (!def) return false;
  panelTheme = def.id;
  panelLastByMode[def.mode] = def.id;
  const data = `data: ${JSON.stringify({ type: "panel.theme", theme: def.id, lastByMode: panelLastByMode })}

`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
  return true;
}
function writePanelFile(directory, runId) {
  if (!panelPort) return;
  try {
    panelFilePath = path2.join(directory, PANEL_FILE);
    fs2.mkdirSync(path2.dirname(panelFilePath), { recursive: true });
    const tmp = `${panelFilePath}.${process.pid}.tmp`;
    fs2.writeFileSync(tmp, JSON.stringify({ port: panelPort, runId, pid: process.pid, startedAt: ts(), token: runToken }, null, 2));
    fs2.renameSync(tmp, panelFilePath);
  } catch (err) {
    log("warn", `failed to write ${PANEL_FILE}: ${errorMessage2(err)}`);
  }
}
function removePanelFile() {
  try {
    if (!panelFilePath) return;
    const rec = JSON.parse(fs2.readFileSync(panelFilePath, "utf-8"));
    if (isObj2(rec) && rec.pid === process.pid) fs2.unlinkSync(panelFilePath);
  } catch {
  }
}
function hookPanelFileExit() {
  if (panelExitHooked) return;
  panelExitHooked = true;
  process.once("exit", removePanelFile);
}
async function shutdownPanel() {
  abortFlag = true;
  if (panelStarting) await panelStarting;
  removePanelFile();
  for (const res of sseClients) {
    try {
      res.end();
    } catch {
    }
  }
  sseClients.clear();
  panelPageClients.clear();
  const srv = panelServer;
  panelServer = null;
  panelPort = 0;
  if (!srv) return;
  srv.closeAllConnections();
  await new Promise((resolve3) => srv.close(() => resolve3()));
}
function loadDesignTokens(directory) {
  const candidates = [
    path2.join(directory, "packages", "design", "src", "tokens.css"),
    path2.join(directory, "..", "packages", "design", "src", "tokens.css")
  ];
  for (const p of candidates) {
    try {
      if (fs2.existsSync(p)) return fs2.readFileSync(p, "utf-8");
    } catch {
    }
  }
  return "";
}
var REPLAYED = /* @__PURE__ */ new Set([
  "run.started",
  "node.state",
  "node.output",
  "run.finished",
  "checkpoint",
  "schema.warning",
  "select.fallback"
]);
function emitPanel(event) {
  if (event.type === "run.started") sseReplayBuffer.length = 0;
  if (REPLAYED.has(event.type)) sseReplayBuffer.push(event);
  const data = `data: ${JSON.stringify(event)}

`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}
var AGENTRY_MARK = '<path fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M2 24 13 4.95h22L46 24 35 43.05H13z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M19 24h4.5v-8H28M23.5 24v8H28"/><g fill="currentColor"><rect x="9" y="19" width="10" height="10" rx="2.5"/><rect x="28" y="13" width="7" height="6" rx="1.5"/><rect x="28" y="29" width="7" height="6" rx="1.5"/></g>';
var PANEL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#16191f"/><g transform="translate(5 5) scale(.7917)" color="#7aa2f7">${AGENTRY_MARK}</g></svg>`;
function getPanelHtml() {
  const theme = PANEL_THEMES.find((t) => t.id === panelTheme);
  const themeState = JSON.stringify({ theme: panelTheme, lastByMode: panelLastByMode });
  return `<!DOCTYPE html><html data-theme="${theme?.id ?? "dark"}" data-mode="${theme?.mode ?? "dark"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agentry — Live Run</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(PANEL_ICON_SVG)}">
<style>
${PANEL_TOKENS_CSS}
${designTokensCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{display:flex;flex-direction:column;background:var(--agentry-color-bg-app);color:var(--agentry-color-text-primary);font-family:var(--agentry-font-sans);font-size:var(--agentry-fs-base);-webkit-font-smoothing:antialiased;overflow:hidden}
.agentry-toolbar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:var(--agentry-space-lg);height:46px;padding:0 var(--agentry-space-xl);background:var(--agentry-color-bg-surface);border-bottom:1px solid var(--agentry-color-border-subtle)}
.agentry-toolbar__brand{display:flex;align-items:center;gap:var(--agentry-space-base);font-size:var(--agentry-fs-md);font-weight:var(--agentry-fw-semibold);color:var(--agentry-color-text-primary)}
.agentry-toolbar__brand svg{display:block;color:var(--agentry-color-accent)}
.agentry-toolbar__scope{margin-left:var(--agentry-space-sm);padding:2px var(--agentry-space-base);border:1px solid var(--agentry-color-border-default);border-radius:var(--agentry-radius-pill);font-family:var(--agentry-font-mono);font-size:var(--agentry-fs-xs);font-weight:var(--agentry-fw-medium);letter-spacing:.04em;text-transform:uppercase;color:var(--agentry-color-text-muted);line-height:1.4}
.agentry-toolbar__actions{display:flex;align-items:center;gap:var(--agentry-space-base)}
.agentry-select{height:30px;max-width:180px;padding:0 var(--agentry-space-base);background:var(--agentry-color-bg-inset);border:1px solid var(--agentry-color-border-default);border-radius:var(--agentry-radius-md);color:var(--agentry-color-text-secondary);font-family:var(--agentry-font-sans);font-size:var(--agentry-fs-sm);cursor:pointer;outline:none;transition:border-color .12s ease,box-shadow .12s ease}
.agentry-select:hover{border-color:var(--agentry-color-border-strong);color:var(--agentry-color-text-primary)}
.agentry-select:focus{border-color:var(--agentry-color-accent);box-shadow:0 0 0 2px var(--agentry-color-accent-muted)}
.agentry-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--agentry-space-md);height:30px;padding:0 var(--agentry-space-lg);background:transparent;border:1px solid var(--agentry-color-border-default);border-radius:var(--agentry-radius-md);color:var(--agentry-color-text-secondary);font-family:var(--agentry-font-sans);font-size:var(--agentry-fs-sm);font-weight:var(--agentry-fw-medium);cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.agentry-btn:hover{background:var(--agentry-color-bg-elevated);border-color:var(--agentry-color-border-strong);color:var(--agentry-color-text-primary)}
.agentry-btn:active{transform:translateY(1px)}
.agentry-btn--primary{background:var(--agentry-color-accent);border-color:var(--agentry-color-accent);color:var(--agentry-color-accent-ink);font-weight:var(--agentry-fw-semibold)}
.agentry-btn--primary:hover{background:var(--agentry-color-accent-hover);border-color:var(--agentry-color-accent-hover);color:var(--agentry-color-accent-ink)}
.agentry-btn--danger{color:var(--agentry-state-failed);border-color:color-mix(in srgb,var(--agentry-state-failed) 45%,transparent)}
.agentry-btn--danger:hover{background:var(--agentry-state-failed-soft);border-color:var(--agentry-state-failed);color:var(--agentry-state-failed)}
.agentry-btn--sm{height:22px;padding:0 var(--agentry-space-base);font-size:var(--agentry-fs-xs);border-radius:var(--agentry-radius-sm)}
.agentry-btn--icon{width:30px;padding:0;border-color:transparent;color:var(--agentry-color-text-muted)}
.agentry-btn--icon:hover{background:var(--agentry-color-bg-elevated);border-color:transparent;color:var(--agentry-color-text-primary)}
.agentry-main{flex:1;overflow:auto;padding:var(--agentry-space-huge) var(--agentry-space-xxl);background-image:radial-gradient(color-mix(in srgb,var(--agentry-color-text-primary) 7%,transparent) 1.4px,transparent 1.4px);background-size:22px 22px}
#canvas{position:relative;margin:0 auto}
#canvas.is-static{max-width:640px}
#canvas.is-static .agentry-node{margin:0 0 var(--agentry-space-lg)}
#edges{position:absolute;top:0;left:0;pointer-events:none}
.agentry-node{display:flex;flex-direction:column;gap:var(--agentry-space-md);background:linear-gradient(180deg,var(--agentry-color-bg-elevated),var(--agentry-color-bg-surface));border:1px solid var(--agentry-color-border-default);border-radius:var(--agentry-radius-lg);padding:var(--agentry-space-base) var(--agentry-space-lg) var(--agentry-space-lg);box-shadow:var(--agentry-shadow-md);transition:border-color .25s ease,box-shadow .25s ease,opacity .25s ease}
.agentry-node.is-running{border-color:var(--agentry-state-running);box-shadow:0 0 0 1px var(--agentry-state-running-soft),var(--agentry-shadow-md)}
.agentry-node.is-done{border-color:var(--agentry-state-done);box-shadow:0 0 0 1px var(--agentry-state-done-soft),var(--agentry-shadow-md)}
.agentry-node.is-failed{border-color:var(--agentry-state-failed);box-shadow:0 0 0 1px var(--agentry-state-failed-soft),var(--agentry-shadow-md)}
.agentry-node.is-skipped{opacity:.65}
.agentry-node__hdr{display:flex;align-items:center;justify-content:space-between;gap:var(--agentry-space-base)}
.agentry-node__name{font-weight:var(--agentry-fw-semibold);font-size:var(--agentry-fs-md);color:var(--agentry-color-text-primary);min-width:0;overflow-wrap:anywhere}
.agentry-node__state{flex:none;display:inline-flex;align-items:center;gap:var(--agentry-space-md);font-size:var(--agentry-fs-xs);font-weight:var(--agentry-fw-medium);color:var(--agentry-color-text-secondary);white-space:nowrap}
.agentry-node__dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--agentry-state-pending)}
.agentry-node__state[data-state='running'] .agentry-node__dot{background:var(--agentry-state-running);animation:agentry-pulse 1.5s ease-in-out infinite}
.agentry-node__state[data-state='done'] .agentry-node__dot{background:var(--agentry-state-done)}
.agentry-node__state[data-state='failed'] .agentry-node__dot{background:var(--agentry-state-failed)}
.agentry-node__state[data-state='skipped'] .agentry-node__dot{background:var(--agentry-state-skipped)}
@keyframes agentry-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.agentry-node__agent{font-family:var(--agentry-font-mono);font-size:var(--agentry-fs-xs);letter-spacing:.04em;text-transform:uppercase;color:var(--agentry-color-text-muted)}
.agentry-node__iter{display:none;font-size:var(--agentry-fs-xs);color:var(--agentry-color-accent)}
.agentry-node__output{display:none;font-family:var(--agentry-font-mono);font-size:var(--agentry-fs-sm);line-height:1.55;color:var(--agentry-color-text-secondary);background:var(--agentry-color-bg-inset);border:1px solid var(--agentry-color-border-subtle);border-radius:var(--agentry-radius-md);padding:var(--agentry-space-base) var(--agentry-space-lg);max-height:200px;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
.agentry-node__warn{display:none;font-size:var(--agentry-fs-xs);line-height:1.45;color:var(--agentry-state-running);overflow-wrap:anywhere}
.agentry-node__foot{display:flex;align-items:center;justify-content:space-between;gap:var(--agentry-space-base);margin-top:var(--agentry-space-xs)}
.agentry-node__timing{font-family:var(--agentry-font-mono);font-size:var(--agentry-fs-xs);color:var(--agentry-color-text-muted)}
.agentry-statusbar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:var(--agentry-space-lg);height:28px;padding:0 var(--agentry-space-xl);background:var(--agentry-color-bg-surface);border-top:1px solid var(--agentry-color-border-subtle);font-size:var(--agentry-fs-xs);color:var(--agentry-color-text-muted)}
#status{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.agentry-statusbar__host{flex:none;font-family:var(--agentry-font-mono)}
.agentry-edge-path{stroke:var(--agentry-color-border-strong);stroke-width:1.5;fill:none;transition:stroke .3s}
.agentry-edge-path.active{stroke:var(--agentry-state-running);stroke-dasharray:6 4;animation:agentry-dash .8s linear infinite}
@keyframes agentry-dash{to{stroke-dashoffset:-10}}
.compact .agentry-node__output,.compact .agentry-node__foot{display:none!important}
.compact .agentry-node{gap:var(--agentry-space-sm);padding-bottom:var(--agentry-space-base)}
.compact .agentry-main{padding-top:var(--agentry-space-xl)}
@media (prefers-reduced-motion:reduce){.agentry-edge-path.active,.agentry-node__state[data-state='running'] .agentry-node__dot{animation:none}}
</style></head>
<body>
<header class="agentry-toolbar">
  <div class="agentry-toolbar__brand"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">${AGENTRY_MARK}</svg><span>Agentry</span><span class="agentry-toolbar__scope">live run</span></div>
  <div class="agentry-toolbar__actions">
    <select class="agentry-select" id="themeSel" title="Color theme" aria-label="Color theme"></select>
    <button class="agentry-btn agentry-btn--icon" id="themeBtn" type="button" aria-label="Toggle light / dark"></button>
    <button class="agentry-btn agentry-btn--primary" id="resumeBtn" type="button" style="display:none">Resume</button>
    <button class="agentry-btn agentry-btn--danger" id="stopBtn" type="button">Stop</button>
  </div>
</header>
<main class="agentry-main" id="main"><div id="canvas" class="is-static"><svg id="edges"></svg></div></main>
<footer class="agentry-statusbar"><span id="status">Waiting for run to start&hellip;</span><span class="agentry-statusbar__host" id="host"></span></footer>
<script>
var THEMES=${JSON.stringify(PANEL_THEMES)},themeState=${themeState};
var canvas=document.getElementById('canvas'),svgEl=document.getElementById('edges'),statusEl=document.getElementById('status'),resumeBtn=document.getElementById('resumeBtn'),themeSel=document.getElementById('themeSel'),themeBtn=document.getElementById('themeBtn');
// ?compact (screen recordings): nodes without output previews and buttons, layers closer together
var COMPACT=new URLSearchParams(location.search).has('compact');if(COMPACT)document.documentElement.classList.add('compact');
var nodeMap={},warnMap={},heights={},dirty={},layout=null,structureDirty=true,lastNW=-1,NW=280,GX=32,GY=COMPACT?30:48;
var STATE_LABEL={pending:'Pending',running:'Running',done:'Done',failed:'Failed',skipped:'Skipped'};
var ICON_SUN='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
var ICON_MOON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function themeDef(id){for(var i=0;i<THEMES.length;i++)if(THEMES[i].id===id)return THEMES[i];return THEMES[0]}
function applyTheme(id){var t=themeDef(id);themeState.theme=t.id;themeState.lastByMode[t.mode]=t.id;document.documentElement.setAttribute('data-theme',t.id);document.documentElement.setAttribute('data-mode',t.mode);themeSel.value=t.id;themeBtn.innerHTML=t.mode==='dark'?ICON_SUN:ICON_MOON;themeBtn.title=t.mode==='dark'?'Switch to light':'Switch to dark'}
function setTheme(id){applyTheme(id);fetch('/api/theme',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({theme:id})})}
(function(){var groups={dark:document.createElement('optgroup'),light:document.createElement('optgroup')};groups.dark.label='Dark';groups.light.label='Light';for(var i=0;i<THEMES.length;i++){var o=document.createElement('option');o.value=THEMES[i].id;o.textContent=THEMES[i].label;groups[THEMES[i].mode].appendChild(o)}themeSel.appendChild(groups.dark);themeSel.appendChild(groups.light)})();
applyTheme(themeState.theme);
themeSel.addEventListener('change',function(){setTheme(themeSel.value)});
themeBtn.addEventListener('click',function(){var target=themeDef(themeState.theme).mode==='dark'?'light':'dark';setTheme(themeState.lastByMode[target]||target)});
document.getElementById('host').textContent=location.host;
document.getElementById('stopBtn').addEventListener('click',function(){fetch('/api/stop',{method:'POST'});statusEl.textContent='Stopping\\u2026'});
resumeBtn.addEventListener('click',function(){fetch('/api/resume',{method:'POST'});resumeBtn.style.display='none';statusEl.textContent='Resuming\\u2026'});
canvas.addEventListener('click',function(e){var b=e.target.closest('[data-rerun]');if(!b)return;var id=b.getAttribute('data-rerun');fetch('/api/rerun/'+encodeURIComponent(id),{method:'POST'});updateNode(id,'pending',{})});
function computeLayers(ids,deps){
  var layers=[],layerOf={},rem=ids.slice();
  while(rem.length>0){var layer=[];for(var i=0;i<rem.length;i++){var id=rem[i],d=deps[id]||[];if(d.every(function(u){return layerOf[u]!==undefined}))layer.push(id)}
  if(!layer.length)break;for(var j=0;j<layer.length;j++)layerOf[layer[j]]=layers.length;
  rem=rem.filter(function(x){return layer.indexOf(x)<0});layers.push(layer)}
  return layers}
// D13 incremental relayout: a run event touches one node, so only that node is re-measured.
// A width change or new nodes force a full pass. Every read happens before any position
// write (one reflow per pass, not one per node), and positions + edges are rebuilt only when
// a measured height actually changed — otherwise just the edge states are repainted.
function sizeNodes(){
  var main=document.getElementById('main'),avail=Math.max(260,main.clientWidth-2*32),maxN=1;
  for(var i=0;i<layout.layers.length;i++)if(layout.layers[i].length>maxN)maxN=layout.layers[i].length;
  NW=Math.floor((avail-(maxN-1)*GX)/maxN);if(NW>380)NW=380;if(NW<200)NW=200;
  if(NW===lastNW&&!structureDirty)return false;
  lastNW=NW;
  for(var j=0;j<layout.ids.length;j++){var el=nodeMap[layout.ids[j]];if(!el)continue;el.style.position='absolute';el.style.width=NW+'px'}
  return true}
function applyLayout(){
  if(!layout){canvas.classList.add('is-static');dirty={};return}
  canvas.classList.remove('is-static');
  var full=sizeNodes(),ids=full?layout.ids:Object.keys(dirty),moved=full;
  for(var i=0;i<ids.length;i++){var el=nodeMap[ids[i]];if(!el)continue;var h=el.offsetHeight;if(heights[ids[i]]!==h){heights[ids[i]]=h;moved=true}}
  dirty={};structureDirty=false;
  if(!moved){paintEdges();return}
  var tw=0;for(var a=0;a<layout.layers.length;a++){var lw=layout.layers[a].length*NW+(layout.layers[a].length-1)*GX;if(lw>tw)tw=lw}
  var pos={},bottoms={},y=0;
  for(var b=0;b<layout.layers.length;b++){var L=layout.layers[b],lw2=L.length*NW+(L.length-1)*GX,ox=(tw-lw2)/2,rowH=0;
    for(var c=0;c<L.length;c++){var id=L[c],node=nodeMap[id];if(!node)continue;var x=ox+c*(NW+GX),hh=heights[id]||0;
      node.style.left=x+'px';node.style.top=y+'px';pos[id]={x:x,y:y};bottoms[id]=y+hh;if(hh>rowH)rowH=hh}
    y+=rowH+GY}
  layout.pos=pos;layout.bottoms=bottoms;
  var th=Math.max(40,y-GY);
  canvas.style.width=tw+'px';canvas.style.height=th+'px';
  svgEl.setAttribute('width',tw);svgEl.setAttribute('height',th);
  drawEdges()}
function drawEdges(){
  svgEl.innerHTML='';
  for(var i=0;i<layout.ids.length;i++){var id=layout.ids[i],d=layout.deps[id]||[];
    for(var j=0;j<d.length;j++){var f=layout.pos[d[j]],t=layout.pos[id];if(!f||!t)continue;
      var x1=f.x+NW/2,y1=layout.bottoms[d[j]]||f.y,x2=t.x+NW/2,y2=t.y,cy=(y1+y2)/2;
      var p=document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d','M'+x1+','+y1+' C'+x1+','+cy+' '+x2+','+cy+' '+x2+','+y2);
      p.setAttribute('data-to',id);svgEl.appendChild(p)}}
  paintEdges()}
function paintEdges(){
  var ps=svgEl.querySelectorAll('path');
  for(var i=0;i<ps.length;i++){var t=nodeMap[ps[i].getAttribute('data-to')];ps[i].setAttribute('class','agentry-edge-path'+(t&&t.classList.contains('is-running')?' active':''))}}
var relayoutQueued=false;
function queueRelayout(){if(relayoutQueued)return;relayoutQueued=true;requestAnimationFrame(function(){relayoutQueued=false;applyLayout()})}
window.addEventListener('resize',queueRelayout);
function ensureNode(id){
  if(nodeMap[id])return nodeMap[id];
  var el=document.createElement('div');el.className='agentry-node is-pending';el.dataset.id=id;
  el.innerHTML='<div class="agentry-node__hdr"><span class="agentry-node__agent"></span><span class="agentry-node__state" data-state="pending"><span class="agentry-node__dot"></span><span class="agentry-node__statelabel">Pending</span></span></div><div class="agentry-node__name"></div><div class="agentry-node__iter"></div><div class="agentry-node__output"></div><div class="agentry-node__warn"></div><div class="agentry-node__foot"><span class="agentry-node__timing"></span><button class="agentry-btn agentry-btn--sm" type="button">Rerun</button></div>';
  el.querySelector('.agentry-node__name').textContent=id;
  el.querySelector('[type="button"]').setAttribute('data-rerun',id);
  canvas.appendChild(el);nodeMap[id]=el;structureDirty=true;queueRelayout();return el}
function markDirty(id){dirty[id]=1;queueRelayout()}
function updateNode(id,state,extra){
  var el=ensureNode(id);
  el.className='agentry-node is-'+state;
  var st=el.querySelector('.agentry-node__state'),lbl=el.querySelector('.agentry-node__statelabel');
  if(extra&&extra.looping){st.setAttribute('data-state','running');lbl.textContent='Looping\\u2026'}
  else{st.setAttribute('data-state',state);lbl.textContent=STATE_LABEL[state]||state}
  if(extra&&extra.agent)el.querySelector('.agentry-node__agent').textContent=extra.agent;
  if(extra&&extra.output){var o=el.querySelector('.agentry-node__output');o.textContent=extra.output;o.style.display='block'}
  if(extra&&extra.ms!==undefined)el.querySelector('.agentry-node__timing').textContent=extra.ms+' ms';
  if(extra&&extra.iteration&&extra.iteration>1){var it=el.querySelector('.agentry-node__iter');it.textContent='Iteration '+extra.iteration;it.style.display='block'}
  markDirty(id)}
function addWarn(id,text){
  var el=ensureNode(id),list=warnMap[id]||(warnMap[id]=[]);
  if(list.indexOf(text)<0)list.push(text);
  var w=el.querySelector('.agentry-node__warn');w.textContent='\\u26a0 '+list.join(' \\u00b7 ');w.style.display='block';
  markDirty(id)}
function resetCanvas(){for(var id in nodeMap)nodeMap[id].remove();nodeMap={};warnMap={};heights={};dirty={};structureDirty=true}
var es=new EventSource('/events?view=panel');
es.onmessage=function(e){
  var d=JSON.parse(e.data);
  if(d.type==='panel.theme'){if(d.lastByMode)themeState.lastByMode=d.lastByMode;applyTheme(d.theme);return}
  if(d.type==='run.started'){
    statusEl.textContent='Running: '+d.workflow+' ('+d.runId+')';document.title=d.workflow+' \\u2014 Agentry';resumeBtn.style.display='none';resetCanvas();
    layout=d.deps?{ids:d.nodeIds,deps:d.deps,layers:computeLayers(d.nodeIds,d.deps)}:null;
    (d.nodeIds||[]).forEach(function(id){ensureNode(id)});queueRelayout()}
  if(d.type==='node.state')updateNode(d.nodeId,d.state,d);
  if(d.type==='node.output')updateNode(d.nodeId,'done',{output:d.chunk});
  if(d.type==='run.finished'){statusEl.textContent='Finished: '+d.status;if(d.status!=='ok')resumeBtn.style.display='inline-flex'}
  if(d.type==='schema.warning')(d.warnings||[]).forEach(function(w){addWarn(d.nodeId,w)});
  if(d.type==='select.fallback')addWarn(d.nodeId,d.reason==='unparseable'?'filter on '+d.from+' bypassed: output was not JSON, passed whole':'filter on '+d.from+': '+(d.missing||[]).join(', ')+' missing')};
</script></body></html>`;
}
var TAURI_ORIGINS = /* @__PURE__ */ new Set(["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"]);
var LOOPBACK_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;
var LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;
var isAllowedOrigin = (origin) => TAURI_ORIGINS.has(origin.toLowerCase()) || LOOPBACK_ORIGIN.test(origin);
function readBody(req, limit = 4096) {
  return new Promise((resolve3, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve3(body));
    req.on("error", reject);
  });
}
function sendJson(res, status, headers, payload) {
  res.writeHead(status, { ...headers, "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}
var RUN_BODY_LIMIT = 1024 * 1024;
async function handleRunRequest(req, res, cors) {
  if (!runToken || req.headers["x-agentry-token"] !== runToken) {
    sendJson(res, 401, cors, { ok: false, error: "missing or wrong X-Agentry-Token (it is in .agentry/panel.json)" });
    return;
  }
  if (!runHost) {
    sendJson(res, 503, cors, { ok: false, error: "plugin not initialised" });
    return;
  }
  let body;
  try {
    body = JSON.parse(await readBody(req, RUN_BODY_LIMIT));
  } catch {
    sendJson(res, 400, cors, { ok: false, error: "body must be JSON {workflow, input?}" });
    return;
  }
  if (typeof body.workflow !== "string" || body.input !== void 0 && typeof body.input !== "string") {
    sendJson(res, 400, cors, { ok: false, error: "workflow (path) must be a string, input (if any) a string" });
    return;
  }
  if (runInProgress) {
    sendJson(res, 409, cors, { ok: false, error: "busy", runId: lastRunId });
    return;
  }
  const loaded = loadWorkflowFile(runHost.directory, body.workflow);
  if (!loaded.ok) {
    sendJson(res, 400, cors, { ok: false, error: loaded.error });
    return;
  }
  const runId = `run_${Date.now()}`;
  runWorkflow(runHost.client, runHost.directory, loaded.workflow, { runId, input: body.input }).then(
    (summary) => log("info", `api run ${runId} done
${summary}`),
    (err) => {
      log("error", `api run ${runId} failed: ${errorMessage2(err)}`);
      emitPanel({ type: "run.finished", runId, status: "error", at: ts() });
    }
  );
  sendJson(res, 202, cors, { ok: true, runId });
}
async function handlePanelRequest(req, res) {
  const host2 = req.headers.host;
  const origin = req.headers.origin;
  if (!host2 || !LOOPBACK_HOST.test(host2) || origin !== void 0 && !isAllowedOrigin(origin)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("forbidden");
    return;
  }
  const cors = origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...cors, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type, X-Agentry-Token", "Access-Control-Max-Age": "600" });
    res.end();
    return;
  }
  const { pathname: url, searchParams } = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url === "/events") {
    res.writeHead(200, { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    for (const event of sseReplayBuffer) {
      try {
        res.write(`data: ${JSON.stringify(event)}

`);
      } catch {
      }
    }
    sseClients.add(res);
    const isPanelPage = searchParams.get("view") === "panel";
    if (isPanelPage) panelPageClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
      panelPageClients.delete(res);
    });
    return;
  }
  if (url === "/health") {
    sendJson(res, 200, cors, { app: "agentry", port: panelPort, runId: lastRunId, pid: process.pid, busy: runInProgress });
    return;
  }
  if (url === "/api/run" && req.method === "POST") {
    await handleRunRequest(req, res, cors);
    return;
  }
  if (url === "/api/theme" && req.method === "POST") {
    let theme;
    try {
      theme = JSON.parse(await readBody(req)).theme;
    } catch {
    }
    const ok = typeof theme === "string" && setPanelTheme(theme);
    sendJson(res, ok ? 200 : 400, cors, ok ? { ok: true, theme: panelTheme } : { ok: false, error: "unknown theme" });
    return;
  }
  if (url === "/api/stop" && req.method === "POST") {
    abortFlag = true;
    sendJson(res, 200, cors, { ok: true });
    return;
  }
  if (url.startsWith("/api/rerun/") && req.method === "POST") {
    rerunNodeId = decodeURIComponent(url.slice("/api/rerun/".length));
    sendJson(res, 200, cors, { ok: true, rerun: rerunNodeId });
    return;
  }
  if (url === "/api/resume" && req.method === "POST") {
    if (runInProgress) {
      sendJson(res, 409, cors, { ok: false, error: "Run already in progress" });
      return;
    }
    if (lastClient && lastWorkflow && lastRunId) {
      runWorkflow(lastClient, lastDirectory, lastWorkflow, { resumeRunId: lastRunId }).catch((err) => {
        log("error", `resume failed: ${errorMessage2(err)}`);
        emitPanel({ type: "run.finished", runId: lastRunId, status: "error", at: ts() });
      });
      sendJson(res, 200, cors, { ok: true, resuming: lastRunId });
    } else {
      sendJson(res, 400, cors, { ok: false, error: "No previous run to resume" });
    }
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(getPanelHtml());
}
var panelStarting = null;
function startPanelServer(directory) {
  if (panelServer) {
    writePanelFile(directory, lastRunId);
    return Promise.resolve(panelPort);
  }
  if (panelStarting) return panelStarting;
  panelStarting = bindPanelServer(directory).finally(() => {
    panelStarting = null;
  });
  return panelStarting;
}
function bindPanelServer(directory) {
  return new Promise((resolve3) => {
    const srv = http.createServer((req, res) => {
      handlePanelRequest(req, res).catch((err) => {
        log("error", `panel request failed: ${errorMessage2(err)}`);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
    srv.on("error", (err) => {
      log("warn", `panel server failed: ${errorMessage2(err)} — continuing without panel`);
      resolve3(0);
    });
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      panelPort = typeof addr === "object" && addr ? addr.port : 0;
      panelServer = srv;
      runToken = randomUUID();
      writePanelFile(directory, "");
      hookPanelFileExit();
      log("info", `panel server on http://127.0.0.1:${panelPort}`);
      resolve3(panelPort);
    });
  });
}
function openBrowser(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {
  });
}
function chromiumCandidates() {
  const env = process.env;
  if (process.platform === "win32") {
    return [
      env["ProgramFiles(x86)"] && path2.join(env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
      env.ProgramFiles && path2.join(env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      env.LOCALAPPDATA && path2.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
      env.ProgramFiles && path2.join(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe")
    ].filter((p) => Boolean(p));
  }
  if (process.platform === "darwin") {
    return ["Google Chrome", "Microsoft Edge", "Chromium"].map((app) => `/Applications/${app}.app/Contents/MacOS/${app}`);
  }
  const bins = ["google-chrome", "chromium", "chromium-browser", "microsoft-edge"];
  return (env.PATH ?? "").split(path2.delimiter).filter(Boolean).flatMap((dir) => bins.map((bin) => path2.join(dir, bin)));
}
function panelProfileDir() {
  const home = os.homedir();
  if (process.platform === "win32") return path2.join(process.env.LOCALAPPDATA ?? path2.join(home, "AppData", "Local"), "Agentry", "panel-window");
  if (process.platform === "darwin") return path2.join(home, "Library", "Application Support", "Agentry", "panel-window");
  return path2.join(process.env.XDG_DATA_HOME ?? path2.join(home, ".local", "share"), "agentry", "panel-window");
}
function openAppWindow(url) {
  const exe = chromiumCandidates().find((p) => fs2.existsSync(p));
  if (!exe) return false;
  const geometry = /^(-?\d+),(-?\d+),(\d+),(\d+)$/.exec(process.env.AGENTRY_PANEL_WINDOW ?? "");
  const args = [
    `--app=${url}`,
    `--user-data-dir=${panelProfileDir()}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...geometry ? [
      `--window-position=${geometry[1]},${geometry[2]}`,
      `--window-size=${geometry[3]},${geometry[4]}`,
      "--disable-features=CalculateNativeWinOcclusion",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding"
    ] : ["--window-size=1180,820"]
  ];
  try {
    const child = spawn2(exe, args, { detached: true, stdio: "ignore" });
    child.on("error", (err) => log("warn", `panel window failed: ${errorMessage2(err)}`));
    child.unref();
    return true;
  } catch (err) {
    log("warn", `panel window failed: ${errorMessage2(err)}`);
    return false;
  }
}
function showPanelWindow(url) {
  if (process.env.AGENTRY_NO_BROWSER || panelPageClients.size > 0) return;
  if (!openAppWindow(url)) openBrowser(url);
}
var entrySet = (wf) => wf.input?.to?.length ? new Set(wf.input.to) : void 0;
function inboundFor(ctx, nodeId, def, parents) {
  if (!ctx.inbound || def.type === "documenter") return void 0;
  const isEntry = ctx.inboundTo ? ctx.inboundTo.has(nodeId) : inputSources(def, parents).length === 0;
  return isEntry ? { label: ctx.inboundLabel ?? "Workflow input", text: ctx.inbound } : void 0;
}
var describeFallback = (f) => f.reason === "unparseable" ? "output is not JSON — passed WHOLE, unfiltered" : `kept field(s) ${f.missing.join(", ")} missing — passed the rest`;
function upstreamContext(def, outputs, parents) {
  const notices = [];
  const parts = [];
  for (const fromId of inputSources(def, parents)) {
    const upstream = outputs.get(fromId);
    if (!upstream) continue;
    const slice = sliceUpstream(upstream, def.input?.select?.[fromId]);
    if (slice.fallback) notices.push({ from: fromId, fallback: slice.fallback });
    parts.push({ from: fromId, text: `[${fromId}]:
${slice.text}` });
  }
  return { parts, notices };
}
var feedbackSection = (feedback) => `Feedback from "${feedback.from}" (round ${feedback.round + 1}):

${feedback.text}`;
function buildPrompt(def, outputs, parents, extras) {
  const { inbound, feedback, previousOutput, runRecords } = extras;
  let prompt = def.prompt ?? "";
  if (inbound) prompt = `${inbound.label}:

${inbound.text}

---

${prompt}`;
  if (feedback) prompt = `${feedbackSection(feedback)}

---

${prompt}`;
  const { parts, notices } = upstreamContext(def, outputs, parents);
  const only = parts.length === 1 ? parts[0] : void 0;
  if (only) prompt = `Context from "${only.from}":

${only.text}

---

${prompt}`;
  else if (parts.length > 1) prompt = `Context from upstream nodes:

${parts.map((p) => p.text).join("\n\n---\n\n")}

===

${prompt}`;
  if (previousOutput) prompt = `Your previous attempt (refine based on this):

${previousOutput}

---

${prompt}`;
  if (def.input?.extra_info) prompt += `

Additional context: ${def.input.extra_info}`;
  if (runRecords) prompt += `

Run records — every other node of this run, in the order it finished (each node's full record is its <id>.log.md beside the report):

${runRecords}`;
  const schema = def.output?.schema ?? {};
  if (Object.keys(schema).length > 0) {
    prompt += `

You MUST respond with a valid JSON object matching this schema: ${JSON.stringify(schema)}. Return ONLY the raw JSON object — no markdown fences, no extra text.`;
  }
  return { prompt, notices };
}
function documenterRecords(ctx, selfId) {
  return ctx.history.filter((r) => r.nodeId !== selfId).map((r, i) => {
    const def = ctx.workflow.agents[r.nodeId];
    const lines = [`### ${i + 1}. ${r.nodeId}${def?.introduction ? ` — ${def.introduction}` : ""}`];
    if (r.state === "skipped") {
      lines.push(`- Result: skipped (${r.reason ?? "not run"})`);
      return lines.join("\n");
    }
    lines.push(`- Result: done · agent ${r.agent ?? "?"} · ${fmtMs(r.ms ?? 0)}${(r.iteration ?? 1) > 1 ? ` · ${r.iteration} iterations` : ""}`);
    if (r.warnings?.length) lines.push(`- Warnings: ${r.warnings.join("; ")}`);
    if (def?.prompt) lines.push(`- Instruction: ${clip(def.prompt.trim(), 600)}`);
    else if (def?.tool) lines.push(`- Tool: ${clip(JSON.stringify(def.tool), 600)}`);
    else if (def?.decision) lines.push(`- Decision: ${clip(JSON.stringify(def.decision.questions), 600)}`);
    const output = ctx.outputs.get(r.nodeId);
    if (output) lines.push("- Output:", "```", clip(output.trim(), 3e3), "```");
    return lines.join("\n");
  }).join("\n\n");
}
var titleCase = (key) => key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
var mappedAgent = (def) => def.agent_mapping?.[runtime] || void 0;
var nodeAgentLabel = (def) => def.type === "tool" ? toolAgentLabel(def.tool) : def.type === "decision" ? decisionAgentLabel(pickBackend(process.env)) : def.type === "sub-workflow" ? "sub-workflow" : mappedAgent(def) ?? `${runtime} default`;
function renderRunReport(ctx, docId, docOutput, schema) {
  const lines = [
    `# Run report — ${ctx.workflow.introduction}`,
    "",
    `- **Run**: \`${ctx.runId}\``,
    `- **Written**: ${ts()} by \`${docId}\``,
    "",
    "## Steps",
    "",
    "| # | Node | Agent | Result | Time |",
    "|---|---|---|---|---|"
  ];
  ctx.history.filter((r) => r.nodeId !== docId).forEach((r, i) => {
    const result = r.state === "skipped" ? `skipped — ${r.reason ?? "not run"}` : (r.iteration ?? 1) > 1 ? `done (${r.iteration} iterations)` : "done";
    lines.push(`| ${i + 1} | \`${r.nodeId}\` | ${r.agent ?? "—"} | ${result} | ${r.ms !== void 0 ? fmtMs(r.ms) : "—"} |`);
  });
  lines.push("");
  const parsed = extractJson(docOutput);
  if (!parsed) {
    lines.push("## Report", "", docOutput.trim(), "");
    return lines.join("\n");
  }
  const keys = [...Object.keys(schema).filter((k) => k in parsed), ...Object.keys(parsed).filter((k) => !(k in schema))];
  for (const key of keys) {
    const value = parsed[key];
    lines.push(`## ${titleCase(key)}`, "");
    if (Array.isArray(value)) lines.push(...value.length ? value.map((v) => `- ${typeof v === "string" ? v : JSON.stringify(v)}`) : ["_None._"]);
    else if (typeof value === "string") lines.push(value.trim());
    else lines.push("```json", JSON.stringify(value, null, 2), "```");
    lines.push("");
  }
  return lines.join("\n");
}
function runSubWorkflowBlackBox(nodeId, def, runDir, iter) {
  const inner = def.tech_stack?.workflow?.introduction ?? "(inlined workflow)";
  const output = JSON.stringify({ sub_workflow: inner, expanded: false });
  fs2.writeFileSync(
    path2.join(runDir, outputFileName(nodeId)),
    JSON.stringify({ nodeId, agent: "sub-workflow", result: output, elapsed_ms: 0, iteration: iter, schemaWarnings: [] }, null, 2)
  );
  fs2.writeFileSync(
    path2.join(runDir, logFileName(nodeId)),
    [`# ${nodeId}`, `- **Type**: sub-workflow (black box — inner workflow missing/invalid)`, `- **Inlined**: ${inner}`, "", "## Output", output].join("\n")
  );
  return { nodeId, agent: "sub-workflow", output, ms: 0, schemaWarnings: [], notices: [], iteration: iter };
}
async function runSubWorkflow(ctx, dagNode, iter, feedback) {
  const { id: nodeId, def } = dagNode;
  const inner = def.tech_stack?.workflow;
  if (!isObj2(inner)) return runSubWorkflowBlackBox(nodeId, def, ctx.runDir, iter);
  const check = checkRunnable(inner);
  if (!check.ok) return { nodeId, agent: "sub-workflow", output: "", ms: 0, schemaWarnings: [], notices: [], iteration: iter, error: `sub-workflow invalid: ${check.errors.join("; ")}` };
  const innerWf = check.workflow;
  const subDir = path2.join(ctx.runDir, nodeId);
  fs2.mkdirSync(subDir, { recursive: true });
  let dag;
  try {
    dag = buildDag(innerWf);
  } catch (err) {
    return { nodeId, agent: "sub-workflow", output: "", ms: 0, schemaWarnings: [], notices: [], iteration: iter, error: `sub-workflow invalid: ${errorMessage2(err)}` };
  }
  const own = upstreamContext(def, ctx.outputs, dagNode.branchParents);
  const inbound = [
    ...own.parts.map((p) => p.text),
    ...feedback ? [feedbackSection(feedback)] : [],
    ...def.input?.extra_info ? [`Additional context: ${def.input.extra_info}`] : []
  ].join("\n\n---\n\n");
  const innerCtx = {
    ...ctx,
    runDir: subDir,
    workflow: innerWf,
    outputs: /* @__PURE__ */ new Map(),
    strict: strictJsonNodes(innerWf),
    history: [],
    scope: `${ctx.scope}${nodeId}/`,
    inbound: inbound || void 0,
    inboundLabel: "Context from the parent workflow",
    inboundTo: entrySet(innerWf)
  };
  const st = newGraphState(dag.order);
  const notices = own.notices.map((n) => ({ consumer: nodeId, ...n }));
  const t0 = Date.now();
  const outcome = await runGraph(innerCtx, dag, st, {
    emit: (event) => {
      if (event.type !== "select.fallback") return;
      const fallback = event.reason === "missing-fields" ? { reason: "missing-fields", missing: event.missing ?? [] } : { reason: "unparseable" };
      notices.push({ consumer: nodeId, from: `${event.from} → ${event.nodeId}`, fallback });
    },
    persist: () => {
    },
    takeRerun: () => null
  });
  const schemaWarnings = st.schemaWarnings.map((w) => `${nodeId}/${w}`);
  const ms = Date.now() - t0;
  if (outcome.status !== "ok") {
    const error = outcome.status === "failed" ? `sub-workflow "${nodeId}" failed at ${outcome.first.nodeId}: ${outcome.first.error}` : outcome.status === "deadlock" ? `sub-workflow "${nodeId}" deadlock (${outcome.stuck} node(s) stuck)` : outcome.status === "budget" ? `sub-workflow "${nodeId}": ${outcome.message}` : `sub-workflow "${nodeId}" stopped by user`;
    return { nodeId, agent: "sub-workflow", output: "", ms, schemaWarnings, notices, iteration: iter, error };
  }
  const lastId = dag.order[dag.order.length - 1];
  const froms = innerWf.output.from ?? (lastId ? [lastId] : []);
  const merged = {};
  for (const f of froms) {
    const out = innerCtx.outputs.get(f);
    if (out === void 0) continue;
    const parsed = extractJson(out);
    if (parsed) Object.assign(merged, parsed);
    else merged[f] = out;
  }
  const output = JSON.stringify(merged);
  const innerRun = innerCtx.history.map((r) => `- \`${r.nodeId}\`: ${r.state === "skipped" ? `skipped — ${r.reason ?? "not run"}` : `done${(r.iteration ?? 1) > 1 ? ` (${r.iteration} iterations)` : ""}`}`);
  fs2.writeFileSync(
    path2.join(ctx.runDir, outputFileName(nodeId)),
    JSON.stringify({ nodeId, agent: "sub-workflow", result: output, elapsed_ms: ms, iteration: iter, schemaWarnings }, null, 2)
  );
  fs2.writeFileSync(
    path2.join(ctx.runDir, logFileName(nodeId)),
    [`# ${nodeId}`, `- **Type**: sub-workflow`, `- **Inner**: ${innerWf.introduction || "(inlined)"}`, `- **Artifacts**: ${nodeId}/`, "", "## Inner run", ...innerRun, "", "## Output", output].join("\n")
  );
  return { nodeId, agent: "sub-workflow", output, ms, schemaWarnings, notices, iteration: iter };
}
async function callAgent(client, sessionId, agent, readOnly, text) {
  const body = { parts: [{ type: "text", text }] };
  if (agent) body.agent = agent;
  if (runtime !== "opencode" && readOnly) body.readOnly = true;
  const result = await client.session.prompt({ path: { id: sessionId }, body });
  return extractText(result.data?.parts ?? result.parts ?? []);
}
async function runToolNode(ctx, dagNode, iter, feedback) {
  const { id: nodeId, def } = dagNode;
  const agent = toolAgentLabel(def.tool);
  const t0 = Date.now();
  const sources = feedback ? [...dagNode.sources, feedback.from] : dagNode.sources;
  const outputs = feedback ? new Map([...ctx.outputs, [feedback.from, feedback.text]]) : ctx.outputs;
  const fail = (error, resolved = [], notices = []) => {
    const ms = Date.now() - t0;
    fs2.writeFileSync(
      path2.join(ctx.runDir, logFileName(nodeId)),
      [
        `# ${nodeId}${iter > 1 ? ` (iter ${iter})` : ""}`,
        `- **Agent**: ${agent}`,
        `- **Elapsed**: ${ms} ms`,
        `- **Result**: FAILED — ${error}`,
        ...notices.length ? ["", "## Template notices", ...notices.map((n) => `- ${n}`)] : [],
        "",
        "## Resolved",
        "```",
        ...resolved,
        "```"
      ].join("\n")
    );
    return { nodeId, agent, output: "", ms, schemaWarnings: [], notices: [], iteration: iter, error };
  };
  if (!def.tool) return fail("tool node has no tool block");
  try {
    const result = await runTool({
      nodeId,
      spec: def.tool,
      projectDir: ctx.directory,
      runDir: ctx.runDir,
      scope: { sources, outputs, input: ctx.inbound }
    });
    const ms = Date.now() - t0;
    for (const n of result.notices) log("warn", `tool ${ctx.scope}${nodeId}: ${n}`);
    const schemaWarnings = validateOutput(nodeId, result.output, def.output?.schema);
    fs2.writeFileSync(
      path2.join(ctx.runDir, outputFileName(nodeId)),
      JSON.stringify({ nodeId, agent, result: result.output, elapsed_ms: ms, iteration: iter, schemaWarnings }, null, 2)
    );
    fs2.writeFileSync(
      path2.join(ctx.runDir, logFileName(nodeId)),
      [
        `# ${nodeId}${iter > 1 ? ` (iter ${iter})` : ""}`,
        `- **Agent**: ${agent}`,
        `- **Elapsed**: ${ms} ms`,
        `- **Iteration**: ${iter}`,
        ...schemaWarnings.length > 0 ? [`- **Schema warnings**: ${schemaWarnings.join("; ")}`] : [],
        ...result.notices.length ? ["", "## Template notices", ...result.notices.map((n) => `- ${n}`)] : [],
        "",
        "## Resolved",
        "```",
        ...result.resolved,
        "```",
        "",
        "## Output",
        result.output
      ].join("\n")
    );
    return { nodeId, agent, output: result.output, ms, schemaWarnings, notices: [], iteration: iter };
  } catch (err) {
    return err instanceof ToolError ? fail(err.message, err.resolved, err.notices) : fail(errorMessage2(err));
  }
}
var DECISION_FALLBACK_AGENT = "general";
async function runDecisionNode(ctx, dagNode, iter, feedback) {
  const { id: nodeId, def } = dagNode;
  const backend = pickBackend(process.env);
  const agent = decisionAgentLabel(backend);
  const t0 = Date.now();
  const iterLabel = iter > 1 ? ` (iter ${iter})` : "";
  const fail = (error, resolved2 = []) => {
    const ms = Date.now() - t0;
    fs2.writeFileSync(
      path2.join(ctx.runDir, logFileName(nodeId)),
      [`# ${nodeId}${iterLabel}`, `- **Agent**: ${agent}`, `- **Elapsed**: ${ms} ms`, `- **Result**: FAILED — ${error}`, "", "## Resolved", "```", ...resolved2, "```"].join("\n")
    );
    return { nodeId, agent, output: "", ms, schemaWarnings: [], notices: [], iteration: iter, error };
  };
  const spec = def.decision;
  if (!spec) return fail("decision node has no decision block");
  let states;
  let notices;
  try {
    const sources = feedback ? [...dagNode.sources, feedback.from] : dagNode.sources;
    const outputs = feedback ? new Map([...ctx.outputs, [feedback.from, feedback.text]]) : ctx.outputs;
    ({ states, notices } = decisionStates(spec, { sources, outputs, input: ctx.inbound }));
  } catch (err) {
    return fail(errorMessage2(err));
  }
  for (const n of notices) log("warn", `decision ${ctx.scope}${nodeId}: ${n}`);
  const resolved = [];
  const askOne = async (state, index) => {
    const head = states.length > 1 ? `### item ${index}` : "### state";
    if (backend === "jev") {
      const reply2 = await askJev({ spec, state, env: process.env });
      resolved.push(head, ...reply2.resolved, "");
      return reply2.answers;
    }
    const agentName = runtime === "opencode" ? await resolveAgent(ctx.client, def.agent_mapping?.opencode?.trim() || DECISION_FALLBACK_AGENT) : mappedAgent(def);
    const session = await ctx.client.session.create({
      body: { title: `${ctx.scope}${nodeId}${states.length > 1 ? ` [${index}]` : ""}${iterLabel}`, parentID: ctx.sessionId }
    });
    const reply = await askLlm(spec, state, (prompt) => callAgent(ctx.client, session.data.id, agentName, true, prompt));
    resolved.push(head, `agent: ${agentName ?? `${runtime} default`}`, ...reply.resolved, "");
    return reply.answers;
  };
  try {
    const perState = await mapLimited(states, backend === "jev" ? JEV_CONCURRENCY : LLM_CONCURRENCY, askOne);
    const record = isBatchDecision(spec) ? { ...batchRecord(spec, perState), backend } : { ...decisionRecord(spec, perState[0] ?? {}), backend };
    const output = JSON.stringify(record);
    const ms = Date.now() - t0;
    fs2.writeFileSync(
      path2.join(ctx.runDir, outputFileName(nodeId)),
      JSON.stringify({ nodeId, agent, result: output, elapsed_ms: ms, iteration: iter, schemaWarnings: [] }, null, 2)
    );
    fs2.writeFileSync(
      path2.join(ctx.runDir, logFileName(nodeId)),
      [
        `# ${nodeId}${iterLabel}`,
        `- **Agent**: ${agent}`,
        `- **Elapsed**: ${ms} ms`,
        `- **Iteration**: ${iter}`,
        `- **States**: ${states.length}`,
        ...notices.length ? ["", "## Template notices", ...notices.map((n) => `- ${n}`)] : [],
        "",
        "## Questions",
        "```json",
        JSON.stringify(spec.questions, null, 2),
        "```",
        "",
        "## Resolved",
        ...resolved,
        "## Output",
        output
      ].join("\n")
    );
    return { nodeId, agent, output, ms, schemaWarnings: [], notices: [], iteration: iter };
  } catch (err) {
    return err instanceof DecisionError ? fail(err.message, [...resolved, ...err.resolved]) : fail(errorMessage2(err), resolved);
  }
}
function writeFailureLog(ctx, nodeId, iter, agent, ms, error, prompt) {
  fs2.writeFileSync(
    path2.join(ctx.runDir, logFileName(nodeId)),
    [
      `# ${nodeId}${iter > 1 ? ` (iter ${iter})` : ""}`,
      `- **Agent**: ${agent}`,
      `- **Elapsed**: ${ms} ms`,
      `- **Result**: FAILED — ${error}`,
      ...prompt ? ["", "## Prompt", "```", prompt, "```"] : []
    ].join("\n")
  );
}
async function runSingleNode(ctx, dagNode, iter, extras) {
  const { id: nodeId, def } = dagNode;
  if (def.type === "sub-workflow") return runSubWorkflow(ctx, dagNode, iter, extras.feedback);
  if (def.type === "tool") return runToolNode(ctx, dagNode, iter, extras.feedback);
  if (def.type === "decision") return runDecisionNode(ctx, dagNode, iter, extras.feedback);
  const mapped = mappedAgent(def);
  const agent = nodeAgentLabel(def);
  if (!mapped) log("warn", `node ${ctx.scope}${nodeId}: agent_mapping has no "${runtime}" entry — running as the host's default agent`);
  if (mapped && runtime === "opencode") {
    try {
      await resolveAgent(ctx.client, mapped);
    } catch (err) {
      const error = errorMessage2(err);
      writeFailureLog(ctx, nodeId, iter, agent, 0, error);
      return { nodeId, agent, output: "", ms: 0, schemaWarnings: [], notices: [], iteration: iter, error };
    }
  }
  const readOnly = READ_ONLY_ROLES.has(def.agent_mapping?.opencode ?? def.tech_stack?.agent ?? "");
  const built = buildPrompt(def, ctx.outputs, dagNode.branchParents, {
    ...extras,
    inbound: inboundFor(ctx, nodeId, def, dagNode.branchParents),
    runRecords: def.type === "documenter" ? documenterRecords(ctx, nodeId) : void 0
  });
  const prompt = built.prompt;
  const notices = built.notices.map((n) => ({ consumer: nodeId, ...n }));
  for (const n of notices) log("warn", `select ${n.from} → ${nodeId}: ${describeFallback(n.fallback)}`);
  const schema = def.output?.schema ?? {};
  const strictJson = ctx.strict.has(nodeId) && Object.keys(schema).length > 0;
  const t0 = Date.now();
  try {
    const session = await ctx.client.session.create({
      body: { title: `${ctx.scope}${nodeId}${iter > 1 ? ` (iter ${iter})` : ""}`, parentID: ctx.sessionId }
    });
    const nodeSession = session.data.id;
    let outputText = await callAgent(ctx.client, nodeSession, mapped, readOnly, prompt);
    if (strictJson && !extractJson(outputText)) {
      try {
        outputText = await callAgent(
          ctx.client,
          nodeSession,
          mapped,
          readOnly,
          `Return ONLY a raw JSON object matching this schema: ${JSON.stringify(schema)}. No prose, no code fences. Your prior output was:
${outputText}`
        );
      } catch {
      }
    }
    const ms = Date.now() - t0;
    const schemaWarnings = validateOutput(nodeId, outputText, schema);
    if (def.type === "documenter") fs2.writeFileSync(path2.join(ctx.runDir, REPORT_FILE), renderRunReport(ctx, nodeId, outputText, schema));
    const iterLabel = iter > 1 ? ` (iter ${iter})` : "";
    fs2.writeFileSync(
      path2.join(ctx.runDir, outputFileName(nodeId)),
      JSON.stringify({ nodeId, agent, result: outputText, elapsed_ms: ms, iteration: iter, schemaWarnings }, null, 2)
    );
    fs2.writeFileSync(
      path2.join(ctx.runDir, logFileName(nodeId)),
      [
        `# ${nodeId}${iterLabel}`,
        `- **Agent**: ${agent}`,
        `- **Elapsed**: ${ms} ms`,
        `- **Iteration**: ${iter}`,
        ...schemaWarnings.length > 0 ? [`- **Schema warnings**: ${schemaWarnings.join("; ")}`] : [],
        ...notices.length > 0 ? ["", "## Filter notices", ...notices.map((n) => `- \`${n.from}\` → \`${nodeId}\`: ${describeFallback(n.fallback)}`)] : [],
        "",
        "## Prompt",
        "```",
        prompt,
        "```",
        "",
        "## Output",
        outputText
      ].join("\n")
    );
    return { nodeId, agent, output: outputText, ms, schemaWarnings, notices, iteration: iter };
  } catch (err) {
    const error = errorMessage2(err);
    const ms = Date.now() - t0;
    writeFailureLog(ctx, nodeId, iter, agent, ms, error, prompt);
    return { nodeId, agent, output: "", ms, schemaWarnings: [], notices, iteration: iter, error };
  }
}
function selectFallbackEvent(runId, nodeId, notice) {
  const { fallback } = notice;
  return {
    type: "select.fallback",
    runId,
    nodeId,
    from: notice.from,
    reason: fallback.reason,
    ...fallback.reason === "missing-fields" ? { missing: fallback.missing } : {},
    at: ts()
  };
}
var RUNTIME_LINT = /* @__PURE__ */ new Set([
  "join-all-over-branch",
  "branch-extra-default",
  "branch-field-missing",
  "branch-on-missing",
  "select-unknown-source",
  "select-field-unknown"
]);
var newGraphState = (order) => ({
  nodeStates: Object.fromEntries(order.map((id) => [id, "pending"])),
  completedOrder: [],
  skippedOrder: [],
  iterations: {},
  loops: {},
  executions: 0,
  timings: [],
  schemaWarnings: [],
  loopNotes: []
});
var describeLoopExit = (head, loop, exit, round) => exit === "max" ? `loop back to "${head}" ended: max ${loop.max} extra round(s) reached` : exit === "no-progress" ? `loop back to "${head}" stopped: "${loop.from}" produced the same output as the previous round (no progress)` : `loop back to "${head}" ended: condition no longer holds after round ${round}`;
async function runGraph(ctx, dag, st, hooks) {
  const { runId } = ctx;
  const emit = hooks.emit;
  const completed = new Set(st.completedOrder);
  const skipped = new Set(st.skippedOrder);
  const settled = /* @__PURE__ */ new Set([...completed, ...skipped]);
  const pending = new Set(dag.order.filter((id) => !settled.has(id)));
  const hasLoops = [...dag.nodes.values()].some((node) => node.loop !== void 0);
  const markSkipped = (id, reason) => {
    skipped.add(id);
    settled.add(id);
    pending.delete(id);
    st.nodeStates[id] = "skipped";
    st.skippedOrder.push(id);
    ctx.history.push({ nodeId: id, state: "skipped", reason });
    emit({ type: "node.state", runId, nodeId: id, state: "skipped", at: ts() });
    log("info", `node.state ${ctx.scope}${id} skipped (${reason})`);
  };
  const isReady = (id) => {
    const node = dag.nodes.get(id);
    if (joinMode(node.def) === "all") return node.upstream.every((d) => settled.has(d));
    const ordering = node.upstream.filter((d) => !node.sources.includes(d));
    return ordering.every((d) => settled.has(d)) && (node.sources.length === 0 || node.sources.some((s) => completed.has(s)));
  };
  const reset = (toReset, keepIterations) => {
    for (const id of toReset) {
      completed.delete(id);
      skipped.delete(id);
      settled.delete(id);
      pending.add(id);
      ctx.outputs.delete(id);
      st.nodeStates[id] = "pending";
      if (!keepIterations) delete st.iterations[id];
      emit({ type: "node.state", runId, nodeId: id, state: "pending", at: ts() });
    }
    const kept = (list) => list.filter((c) => !toReset.has(c));
    st.completedOrder.splice(0, st.completedOrder.length, ...kept(st.completedOrder));
    st.skippedOrder.splice(0, st.skippedOrder.length, ...kept(st.skippedOrder));
    ctx.history.splice(0, ctx.history.length, ...ctx.history.filter((r) => !toReset.has(r.nodeId)));
  };
  const roundResetSet = (body) => {
    const toReset = new Set(body);
    for (let grew = true; grew; ) {
      grew = false;
      for (const id of skipped) {
        if (toReset.has(id)) continue;
        const node = dag.nodes.get(id);
        if (node.upstream.length > 0 && node.upstream.every((dep) => toReset.has(dep))) {
          toReset.add(id);
          grew = true;
        }
      }
    }
    return toReset;
  };
  const decideLoops = (tail, output) => {
    const restarted = [];
    for (const head of dag.nodes.values()) {
      const loop = head.loop;
      if (!loop || loop.from !== tail) continue;
      const previous = st.loops[head.id];
      const round = previous?.round ?? 0;
      const exit = loop.when && !matchesCondition(output, loop.when) ? "condition" : round >= loop.max ? "max" : previous && previous.text.trim() === output.trim() ? "no-progress" : null;
      if (exit) {
        const note2 = describeLoopExit(head.id, loop, exit, round + 1);
        st.loopNotes.push(note2);
        emit({ type: "node.output", runId, nodeId: tail, chunk: `↻ ${note2}`, at: ts() });
        log(exit === "no-progress" ? "warn" : "info", `${ctx.scope}${note2}`);
        delete st.loops[head.id];
        continue;
      }
      st.loops[head.id] = { from: tail, round: round + 1, text: output };
      for (const inner of dag.nodes.values()) if (inner.id !== head.id && inner.loop && loop.body.has(inner.id)) delete st.loops[inner.id];
      reset(roundResetSet(loop.body), true);
      restarted.push(head.id);
      const note = `looping back to "${head.id}" (round ${round + 2}, max ${loop.max} extra)`;
      emit({ type: "node.output", runId, nodeId: tail, chunk: `↻ ${note}`, at: ts() });
      log("info", `${ctx.scope}${note}`);
    }
    return restarted;
  };
  while (pending.size > 0) {
    if (abortFlag) {
      hooks.persist();
      return { status: "cancelled" };
    }
    const target = hooks.takeRerun();
    if (target && dag.nodes.has(target)) {
      const toReset = /* @__PURE__ */ new Set([target, ...findDownstream(target, dag)]);
      reset(toReset, false);
      hooks.persist();
      log("info", `rerun: reset ${[...toReset].join(", ")}`);
      continue;
    }
    for (const id of [...pending]) {
      const node = dag.nodes.get(id);
      if (joinMode(node.def) === "any" && node.sources.length > 0 && node.sources.every((s) => skipped.has(s))) {
        markSkipped(id, "every upstream was skipped (join: any)");
      }
    }
    if (pending.size === 0) break;
    const ready = [...pending].filter(isReady);
    if (ready.length === 0) return { status: "deadlock", stuck: pending.size };
    const toRun = [];
    for (const id of ready) {
      if (gateUnmet(dag.nodes.get(id).def, ctx.outputs, skipped)) markSkipped(id, "trigger.when not met");
      else toRun.push(id);
    }
    if (toRun.length === 0) {
      hooks.persist();
      continue;
    }
    if (hasLoops && st.executions + toRun.length > RUN_EXECUTION_BUDGET) {
      const message = `loop budget exceeded: ${st.executions} node executions so far, ${toRun.length} more would pass the limit of ${RUN_EXECUTION_BUDGET}`;
      for (const id of toRun) {
        st.nodeStates[id] = "failed";
        emit({ type: "node.state", runId, nodeId: id, state: "failed", at: ts() });
      }
      hooks.persist();
      log("error", `${ctx.scope}${message}`);
      return { status: "budget", message };
    }
    st.executions += toRun.length;
    for (const id of toRun) {
      const a = nodeAgentLabel(dag.nodes.get(id).def);
      const iter = (st.iterations[id] ?? 0) + 1;
      st.nodeStates[id] = "running";
      emit({ type: "node.state", runId, nodeId: id, state: "running", agent: a, iteration: iter, at: ts() });
      log("info", `node.state ${ctx.scope}${id} running (${a}, iter ${iter})`);
    }
    hooks.persist();
    const branchSkipSeed = /* @__PURE__ */ new Set();
    const doneThisWave = [];
    const failedThisWave = [];
    const wave = await Promise.allSettled(
      toRun.map((id) => {
        const iter = (st.iterations[id] ?? 0) + 1;
        return runSingleNode(ctx, dag.nodes.get(id), iter, { previousOutput: ctx.outputs.get(id), feedback: st.loops[id] });
      })
    );
    for (const s of wave) {
      const r = s.status === "fulfilled" ? s.value : { nodeId: "unknown", agent: "unknown", output: "", ms: 0, schemaWarnings: [], notices: [], error: errorMessage2(s.reason) };
      const iter = r.iteration ?? 1;
      st.timings.push({ nodeId: `${ctx.scope}${r.nodeId}`, agent: r.agent, ms: r.ms, iteration: iter });
      st.iterations[r.nodeId] = iter;
      for (const notice of r.notices) emit(selectFallbackEvent(runId, r.nodeId, notice));
      if (r.error) {
        st.nodeStates[r.nodeId] = "failed";
        failedThisWave.push(r);
        continue;
      }
      ctx.outputs.set(r.nodeId, r.output);
      const def = dag.nodes.get(r.nodeId).def;
      const loop = def.trigger?.loop;
      const loopContinue = loop && iter < (loop.max ?? 3) && loop.exit_when && !matchesCondition(r.output, loop.exit_when);
      if (loopContinue) {
        st.nodeStates[r.nodeId] = "pending";
        emit({ type: "node.state", runId, nodeId: r.nodeId, state: "done", ms: r.ms, iteration: iter, looping: true, at: ts() });
        log("info", `node ${ctx.scope}${r.nodeId} loop iter ${iter} — re-queuing`);
      } else {
        completed.add(r.nodeId);
        settled.add(r.nodeId);
        pending.delete(r.nodeId);
        st.nodeStates[r.nodeId] = "done";
        st.completedOrder.push(r.nodeId);
        doneThisWave.push(r.nodeId);
        ctx.history.push({ nodeId: r.nodeId, state: "done", agent: r.agent, ms: r.ms, iteration: iter, warnings: r.schemaWarnings });
        const chunk = r.output.length > 300 ? r.output.slice(0, 300) + "…" : r.output;
        emit({ type: "node.output", runId, nodeId: r.nodeId, chunk, at: ts() });
        emit({ type: "node.state", runId, nodeId: r.nodeId, state: "done", ms: r.ms, iteration: iter, at: ts() });
        log("info", `node.state ${ctx.scope}${r.nodeId} done (${r.ms}ms, iter ${iter})`);
        if (decideLoops(r.nodeId, r.output).length > 0) {
          doneThisWave.splice(doneThisWave.indexOf(r.nodeId), 1);
        } else if (isRouter(def) && def.branch_on) {
          const value = extractJson(r.output)?.[def.branch_on];
          const routes = def.routes ?? [];
          const taken = pickBranchRoute(routes, value);
          for (const rt of routes) if (rt.to !== taken?.to) branchSkipSeed.add(rt.to);
          emit({ type: "node.output", runId, nodeId: r.nodeId, chunk: `↳ routed on ${def.branch_on}=${JSON.stringify(value)} → ${taken ? taken.to : "(no port matched)"}`, at: ts() });
          log("info", `branch ${ctx.scope}${r.nodeId} on ${def.branch_on}=${JSON.stringify(value)} → ${taken ? taken.to : "none"}`);
        }
      }
      st.schemaWarnings.push(...r.schemaWarnings);
      if (r.schemaWarnings.length > 0) {
        emit({ type: "schema.warning", runId, nodeId: r.nodeId, warnings: r.schemaWarnings, at: ts() });
      }
    }
    if (failedThisWave.length > 0) {
      if (abortFlag) {
        for (const f of failedThisWave) {
          st.nodeStates[f.nodeId] = "pending";
          emit({ type: "node.state", runId, nodeId: f.nodeId, state: "pending", at: ts() });
        }
        hooks.persist();
        return { status: "cancelled" };
      }
      hooks.persist();
      for (const id of doneThisWave) emit({ type: "checkpoint", runId, nodeId: id, at: ts() });
      for (const f of failedThisWave) emit({ type: "node.state", runId, nodeId: f.nodeId, state: "failed", at: ts() });
      return { status: "failed", first: failedThisWave[0] };
    }
    if (branchSkipSeed.size > 0) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const id of [...pending]) {
          const reason = branchSkipReason(dag.nodes.get(id), branchSkipSeed, skipped);
          if (!reason) continue;
          branchSkipSeed.add(id);
          markSkipped(id, reason);
          changed = true;
        }
      }
    }
    hooks.persist();
    for (const id of doneThisWave) emit({ type: "checkpoint", runId, nodeId: id, at: ts() });
    for (const id of [...pending].filter(isReady)) {
      for (const src of dag.nodes.get(id).sources) if (completed.has(src)) emit({ type: "handoff", runId, from: src, to: id, at: ts() });
    }
  }
  return { status: "ok" };
}
var INPUT_FILE = "input.txt";
async function runWorkflow(client, directory, wf, opts = {}) {
  if (runInProgress) throw new Error("A run is already in progress - stop it first");
  runInProgress = true;
  try {
    const { resumeRunId } = opts;
    agentCache = null;
    abortFlag = false;
    rerunNodeId = null;
    lastClient = client;
    lastDirectory = directory;
    lastWorkflow = wf;
    designTokensCss = loadDesignTokens(directory);
    const dag = buildDag(wf);
    const runId = resumeRunId ?? opts.runId ?? `run_${Date.now()}`;
    const runDir = path2.join(directory, RUN_DIR_ROOT, runId);
    fs2.mkdirSync(runDir, { recursive: true });
    const inputPath = path2.join(runDir, INPUT_FILE);
    let input = opts.input;
    if (input !== void 0) fs2.writeFileSync(inputPath, input);
    else if (resumeRunId && fs2.existsSync(inputPath)) input = fs2.readFileSync(inputPath, "utf-8");
    const prior = resumeRunId ? loadCheckpoint(runDir) : null;
    const st = prior ? {
      ...newGraphState(dag.order),
      nodeStates: prior.nodes,
      completedOrder: [...prior.completed],
      skippedOrder: [...prior.skipped ?? []],
      iterations: { ...prior.iterations ?? {} },
      loops: { ...prior.loops ?? {} },
      executions: prior.executions ?? 0
    } : newGraphState(dag.order);
    const persist = () => saveCheckpoint(runDir, {
      runId,
      workflow: wf.introduction,
      nodes: st.nodeStates,
      completed: st.completedOrder,
      skipped: st.skippedOrder,
      iterations: st.iterations,
      ...Object.keys(st.loops).length ? { loops: st.loops } : {},
      ...st.executions ? { executions: st.executions } : {},
      updatedAt: ts()
    });
    if (!prior) persist();
    const settledBefore = /* @__PURE__ */ new Set([...st.completedOrder, ...st.skippedOrder]);
    if (dag.order.every((id) => settledBefore.has(id))) return `Run ${runId}: all nodes already completed.`;
    const port = await startPanelServer(directory);
    const panelUrl = port ? `http://127.0.0.1:${port}` : "(panel unavailable)";
    if (port) showPanelWindow(panelUrl);
    const waitedOn = new Set([...dag.nodes.values()].filter((n) => n.def.type !== "documenter").flatMap((n) => n.upstream));
    const deps = {};
    for (const [id, node] of dag.nodes) {
      deps[id] = node.def.type === "documenter" ? node.upstream.filter((d) => node.sources.includes(d) || !waitedOn.has(d)) : [...node.upstream];
    }
    lastRunId = runId;
    writePanelFile(directory, runId);
    emitPanel({ type: "run.started", runId, workflow: wf.introduction, nodeIds: dag.order, deps, at: ts() });
    log("info", `run.started ${runId} | panel: ${panelUrl}`);
    const sess = await client.session.create({ body: { title: `Agentry: ${wf.introduction} (${runId})` } });
    const ctx = {
      client,
      sessionId: sess.data.id,
      runId,
      directory,
      runDir,
      workflow: wf,
      outputs: /* @__PURE__ */ new Map(),
      strict: strictJsonNodes(wf),
      history: [],
      scope: "",
      inbound: input || void 0,
      inboundLabel: "Workflow input",
      inboundTo: entrySet(wf)
    };
    for (const doneId of st.completedOrder) {
      try {
        const d = JSON.parse(fs2.readFileSync(path2.join(runDir, outputFileName(doneId)), "utf-8"));
        if (!isObj2(d)) continue;
        if (typeof d.result === "string" && d.result) ctx.outputs.set(doneId, d.result);
        ctx.history.push({
          nodeId: doneId,
          state: "done",
          agent: typeof d.agent === "string" ? d.agent : void 0,
          ms: typeof d.elapsed_ms === "number" ? d.elapsed_ms : void 0,
          iteration: typeof d.iteration === "number" ? d.iteration : void 0
        });
      } catch {
      }
    }
    for (const id of st.skippedOrder) ctx.history.push({ nodeId: id, state: "skipped", reason: "skipped earlier in this run" });
    const outcome = await runGraph(ctx, dag, st, {
      emit: emitPanel,
      persist,
      takeRerun: () => {
        const target = rerunNodeId;
        rerunNodeId = null;
        return target;
      }
    });
    if (outcome.status === "cancelled") {
      emitPanel({ type: "run.finished", runId, status: "cancelled", at: ts() });
      return `Run ${runId} STOPPED by user. Resume: ${runId}`;
    }
    if (outcome.status === "deadlock") {
      emitPanel({ type: "run.finished", runId, status: "error", at: ts() });
      return `Run ${runId} DEADLOCK: ${outcome.stuck} node(s) stuck — check for circular dependencies.`;
    }
    if (outcome.status === "budget") {
      emitPanel({ type: "run.finished", runId, status: "error", at: ts() });
      return `Run ${runId} FAILED: ${outcome.message}. Lower the loops' max rounds or give them a condition that ends them.`;
    }
    if (outcome.status === "failed") {
      emitPanel({ type: "run.finished", runId, status: "error", at: ts() });
      return `Run ${runId} FAILED at "${outcome.first.nodeId}" (${outcome.first.agent}): ${outcome.first.error}`;
    }
    emitPanel({ type: "run.finished", runId, status: "ok", at: ts() });
    log("info", `run.finished ${runId} ok | panel: ${panelUrl}`);
    const completed = new Set(st.completedOrder);
    const documenter = dag.order.find((id) => dag.nodes.get(id).def.type === "documenter" && completed.has(id));
    const lint = validateWorkflow(wf).filter((issue) => RUNTIME_LINT.has(issue.code));
    return [
      "=== WORKFLOW RUN COMPLETE ===",
      "",
      `Workflow : ${wf.introduction}`,
      `Run ID   : ${runId}`,
      `Artifacts: ${runDir}`,
      ...documenter ? [`Report   : ${path2.join(runDir, REPORT_FILE)}`] : [],
      `Session  : ${ctx.sessionId}`,
      `Panel    : ${panelUrl}`,
      `Resumed  : ${resumeRunId ? "yes" : "no"}`,
      ...input ? [`Input    : ${inputPath}`] : [],
      "",
      "-- Node timings --",
      ...st.timings.map((t) => `  ${t.nodeId} (${t.agent}): ${t.ms} ms${(t.iteration ?? 1) > 1 ? ` [iter ${t.iteration}]` : ""}`),
      ...st.skippedOrder.length > 0 ? ["", "-- Skipped --", ...ctx.history.filter((r) => r.state === "skipped").map((r) => `  ${r.nodeId}: ${r.reason ?? "skipped"}`)] : [],
      ...st.schemaWarnings.length > 0 ? ["", "-- Schema warnings --", ...st.schemaWarnings.map((w) => `  ⚠ ${w}`)] : [],
      ...lint.length > 0 ? ["", "-- Workflow lint --", ...lint.map((issue) => `  ${issue.severity === "error" ? "✖" : "⚠"} ${issue.message}`)] : [],
      ...Object.values(st.iterations).some((v) => v > 1) ? ["", "-- Loop iterations --", ...Object.entries(st.iterations).filter(([, v]) => v > 1).map(([k, v]) => `  ${k}: ${v} iterations`)] : [],
      ...st.loopNotes.length > 0 ? ["", "-- Loops --", ...st.loopNotes.map((note) => `  ↻ ${note}`)] : [],
      "",
      "-- Artifacts --",
      ...dag.order.filter((id) => completed.has(id)).map((id) => `  ${outputFileName(id)}  ${logFileName(id)}`),
      ...documenter ? [`  ${REPORT_FILE}`] : [],
      `  ${CHECKPOINT_FILE}`
    ].join("\n");
  } finally {
    runInProgress = false;
  }
}
function loadWorkflowFile(directory, file) {
  const candidates = [path2.resolve(directory, file), path2.resolve(directory, "..", file), path2.resolve(file)];
  const yamlPath = candidates.find((p) => fs2.existsSync(p));
  if (!yamlPath) return { ok: false, error: `Error: file not found. Tried:
${candidates.map((c) => "  " + c).join("\n")}` };
  let raw;
  try {
    raw = (0, import_yaml2.parse)(fs2.readFileSync(yamlPath, "utf-8"));
  } catch (err) {
    return { ok: false, error: `YAML parse error: ${errorMessage2(err)}` };
  }
  const check = checkRunnable(raw);
  if (!check.ok) return { ok: false, error: ["Workflow validation failed:", ...check.errors.map((e) => `  • ${e}`)].join("\n") };
  return { ok: true, workflow: check.workflow };
}
var RUN_TOOL_DESCRIPTION = "Run an Agentry workflow from a YAML file. Pass `workflow` with a path to run it. Omit for the built-in 2-node demo. Pass `resume` with a run ID to continue an interrupted run. Pass `input` to hand the workflow's entry nodes some context (what started the run).";
var RUN_ARGS = {
  workflow: "Path to workflow.yaml relative to project root",
  resume: "Run ID to resume, e.g. run_1719200000000",
  input: "Context for the entry nodes (the nodes wired from IN), e.g. a trigger event"
};
var DEMO_WORKFLOW = {
  introduction: "B0 Spike (hardcoded 2-node demo)",
  type: "pipeline",
  input: { description: "project directory" },
  output: { description: "project summary" },
  agents: {
    explore_code: {
      prompt: "List the top-level files and directories in this project. Return a brief summary. Be concise — no more than 15 lines.",
      agent_mapping: { opencode: "explore" },
      output: { schema: {} }
    },
    write_summary: {
      prompt: "Write a one-paragraph project summary (≤100 words). Return only the summary text.",
      input: { from: "explore_code" },
      agent_mapping: { opencode: "build" },
      output: { schema: {} }
    }
  },
  workflow: ["explore_code", "write_summary"]
};
async function runFromArgs(client, directory, args) {
  if (!args.workflow) return await runWorkflow(client, directory, DEMO_WORKFLOW);
  const loaded = loadWorkflowFile(directory, args.workflow);
  if (!loaded.ok) return loaded.error;
  return await runWorkflow(client, directory, loaded.workflow, { resumeRunId: args.resume, input: args.input });
}
async function promptV2(ctx, sessionID, body) {
  if (typeof body.agent === "string" && body.agent) await ctx.session.switchAgent({ sessionID, agent: body.agent });
  const sent = await ctx.session.prompt({ sessionID, text: extractText(Array.isArray(body.parts) ? body.parts : []) });
  await ctx.session.wait({ sessionID });
  const messages = await ctx.session.context({ sessionID });
  const after = messages.slice(messages.findIndex((m) => m.id === sent.id) + 1);
  const idle = after.find((m) => m.type === "idle");
  if (!idle) throw new Error("opencode reported the session idle before it answered");
  if (idle.outcome !== "succeeded") throw new Error(idle.error?.message ?? `the session ended ${idle.outcome}`);
  const replies = after.filter((m) => m.type === "assistant").map((m) => extractText(m.content ?? [])).filter(Boolean);
  return replies[replies.length - 1] ?? "";
}
function v2Client(ctx, model) {
  const location = { directory: ctx.location.directory };
  return {
    app: {
      agents: async () => ({ data: (await ctx.agent.list({ location })).data.map((a) => ({ name: a.id })) }),
      log: async ({ body }) => {
        const file = path2.join(location.directory, ".agentry", "agentry.log");
        fs2.mkdirSync(path2.dirname(file), { recursive: true });
        fs2.appendFileSync(file, `${ts()} ${body.level} ${body.message}
`);
      }
    },
    session: {
      // node sessions run on the model of the conversation that started the run
      create: async ({ body }) => {
        const session = await ctx.session.create({
          title: body.title,
          location,
          ...body.parentID ? { parentID: body.parentID } : {},
          ...model ? { model } : {}
        });
        return { data: { id: session.id } };
      },
      prompt: async ({ path: { id }, body }) => ({ data: { parts: [{ type: "text", text: await promptV2(ctx, id, body) }] } })
    }
  };
}
function attachHost(input) {
  const { client, directory } = input;
  runtime = input.runtime ?? "opencode";
  host = client;
  runHost = { client, directory };
  void startPanelServer(directory);
}
function createHostRunner(input) {
  attachHost(input);
  return {
    start(file, opts = {}) {
      const loaded = loadWorkflowFile(input.directory, file);
      if (!loaded.ok) throw new Error(loaded.error);
      if (runInProgress) throw new Error(`a run is already going (${lastRunId}) — wait for it or stop it first`);
      const runId = opts.resumeRunId ?? `run_${Date.now()}`;
      const finished = runWorkflow(input.client, input.directory, loaded.workflow, { runId, input: opts.input, resumeRunId: opts.resumeRunId });
      finished.catch((err) => {
        log("error", `run ${runId} failed: ${errorMessage2(err)}`);
        emitPanel({ type: "run.finished", runId, status: "error", at: ts() });
      });
      return { runId, finished };
    },
    busy: () => runInProgress,
    stop: () => {
      abortFlag = true;
    },
    dispose: shutdownPanel
  };
}
var agentry_default = {
  id: "agentry",
  // opencode 1
  server: async (input) => {
    const { client, directory } = input;
    const { tool } = await import("@opencode-ai/plugin");
    attachHost(input);
    return {
      tool: {
        agentry_run: tool({
          description: RUN_TOOL_DESCRIPTION,
          args: {
            workflow: tool.schema.string().optional().describe(RUN_ARGS.workflow),
            resume: tool.schema.string().optional().describe(RUN_ARGS.resume),
            input: tool.schema.string().optional().describe(RUN_ARGS.input)
          },
          async execute(args) {
            return await runFromArgs(client, directory, args);
          }
        })
      },
      // D12: opencode's instance finalizer — close the panel and withdraw panel.json
      dispose: shutdownPanel
    };
  },
  // opencode 2: same tool and panel; the returned cleanup is that host's instance finalizer
  setup: async (ctx) => {
    const { directory } = ctx.location;
    const client = v2Client(ctx);
    attachHost({ client, directory });
    const registration = await ctx.tool.transform((tools) => tools.add({
      name: "agentry_run",
      description: RUN_TOOL_DESCRIPTION,
      input: {
        type: "object",
        properties: {
          workflow: { type: "string", description: RUN_ARGS.workflow },
          resume: { type: "string", description: RUN_ARGS.resume },
          input: { type: "string", description: RUN_ARGS.input }
        },
        additionalProperties: false
      },
      execute: async (args, context) => {
        const { model } = await ctx.session.get({ sessionID: context.sessionID });
        return { content: await runFromArgs(v2Client(ctx, model), directory, args) };
      }
    }));
    return async () => {
      await registration.dispose();
      await shutdownPanel();
    };
  }
};
export {
  createHostRunner,
  agentry_default as default
};
