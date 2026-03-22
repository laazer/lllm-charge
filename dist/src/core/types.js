// Core type definitions for the LLM-Charge unified system
// FEATURE: Type system foundation for cross-project integration
export var NodeKind;
(function (NodeKind) {
    NodeKind["File"] = "file";
    NodeKind["Module"] = "module";
    NodeKind["Class"] = "class";
    NodeKind["Function"] = "function";
    NodeKind["Method"] = "method";
    NodeKind["Variable"] = "variable";
    NodeKind["Interface"] = "interface";
    NodeKind["Type"] = "type";
    NodeKind["Import"] = "import";
    NodeKind["Export"] = "export";
    NodeKind["Signal"] = "signal";
    NodeKind["Node"] = "node";
    NodeKind["Scene"] = "scene";
    NodeKind["Script"] = "script";
})(NodeKind || (NodeKind = {}));
export var EdgeKind;
(function (EdgeKind) {
    EdgeKind["Contains"] = "contains";
    EdgeKind["Calls"] = "calls";
    EdgeKind["Imports"] = "imports";
    EdgeKind["Extends"] = "extends";
    EdgeKind["Implements"] = "implements";
    EdgeKind["References"] = "references";
    EdgeKind["Returns"] = "returns";
    EdgeKind["DependsOn"] = "depends_on";
})(EdgeKind || (EdgeKind = {}));
