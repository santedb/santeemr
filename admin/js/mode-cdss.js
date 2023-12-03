
ace.define("ace/mode/cdss_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (require, exports, module) {
    /*
     * based on
     * " Vim ABAP syntax file
     * "    Language: SAP - ABAP/R4
     * "    Revision: 2.1
     * "  Maintainer: Marius Piedallu van Wyk <lailoken@gmail.com>
     * " Last Change: 2012 Oct 23
     */

    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    var CdssHilightRules = function () {

        var keywordMapper = this.createKeywordMapper({
            "variable.language": "this",
            "keyword":
                "define include library having with define end as fact protocol rule data to raise const logic metadata model propose assign repeat apply normalize",
            "constant.language":
                "true false hdsi none all any query csharp active dont-use trial-use retired warn danger info",
            "support.type":
                "string bool int real long",
            "keyword.operator":
                "id uuid status oid context when then type for iterations computed",
            "storage.type": "Patient Act SubstanceAdministration Procedure QuantityObservation CodedObservation TextObservation PatientEncounter Narrative"
        }, "text", true, " ");

        this.$rules = {
            "start": [
                { token: "string", regex: /\"(?:.|\"\")*\"/ },
                { token: "qstring", regex: /\$\$/, next: "qstring" },
                { token: "string", regex: /\{.*?\}/ },
                { token: "string", regex: /\<.*?\>/ },
                { token: "doc.comment", regex: /(doc|version|author).*$/ },
                { token: "doc.comment", regex: /\/\/.+$/ },
                { token: "comment", regex: /\/\/.+$/ },
                { token: "invalid", regex: "\\.{2,}" },
                { token: "keyword.operator", regex: /\W[\-+%=<>*]\W|\*\*|[~:,\.&$]|->*?|=>/ },
                { token: "paren.lparen", regex: "[\\[({]" },
                { token: "paren.rparen", regex: "[\\])}]" },
                { token: "constant.numeric", regex: "[+-]?\\d+\\b" },
                { token: "variable.parameter", regex: /sy|pa?\d\d\d\d\|t\d\d\d\.|innnn/ },
                { token: "variable.parameter", regex: /\w+-\w[\-\w]*/ },
                { token: keywordMapper, regex: "\\b\\w+\\b" },
                { caseInsensitive: true }
            ],
            "qstring": [
                { token: "constant.language.escape", regex: /\\\$\\\$/ },
                { token: "qstring", regex: /\$\$/, next: "start" },
                { defaultToken: "qstring" }
            ]
        };
    };
    oop.inherits(CdssHilightRules, TextHighlightRules);

    exports.CdssHilightRules = CdssHilightRules;

});


ace.define("ace/mode/cdss",["require","exports","module","ace/mode/cdss_highlight_rules","ace/range","ace/mode/text","ace/lib/oop"], function(require, exports, module){"use strict";
var Rules = require("./cdss_highlight_rules").CdssHilightRules;
var Range = require("../range").Range;
var TextMode = require("./text").Mode;
var oop = require("../lib/oop");
function Mode() {
    this.HighlightRules = Rules;
}
oop.inherits(Mode, TextMode);
(function () {
    this.lineCommentStart = '"';
    this.getNextLineIndent = function (state, line, tab) {
        var indent = this.$getIndent(line);
        return indent;
    };
    this.$id = "ace/mode/cdss";
}).call(Mode.prototype);
exports.Mode = Mode;

});                (function() {
                    ace.require(["ace/mode/cdss"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();