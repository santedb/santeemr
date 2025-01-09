/*
 * Copyright (C) 2021 - 2024, SanteSuite Inc. and the SanteSuite Contributors (See NOTICE.md for full copyright notices)
 * Copyright (C) 2019 - 2021, Fyfe Software Inc. and the SanteSuite Contributors
 * Portions Copyright (C) 2015-2018 Mohawk College of Applied Arts and Technology
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you 
 * may not use this file except in compliance with the License. You may 
 * obtain a copy of the License at 
 * 
 * http://www.apache.org/licenses/LICENSE-2.0 
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the 
 * License for the specific language governing permissions and limitations under 
 * the License.
 */

/**
 * @summary A RIM based editor
 * @param {*} controlName The name of the control to which the ACE language editor is to be attached
 * @param {*} templateDefinition The initial text of the ACE editor
 */
function RimAceEditor(controlName, templateDefinition) {

    const _sysVars = {
        "Guid": [
            { name: "Current Patient UUID", value: "{{ $recordTargetId }}", type: "Variable", documentation: "The patient for the current encounter/visit" },
            { name: "Current Facility UUID", value: "{{ $facilityId }}", type: "Variable", documentation: "The current/default facility the user has logged into" },
            { name: "Current User UUID", value: "{{ $userEntityId }}", type: "Variable", documentation: "The current UserEntity which is logged in" }
        ],
        "DateTimeOffset": [
            { name: "Current Time", value: " {{ $now }}", type: "Variable", documentation: "The current system time" },
            { name: "Current Date", value: " {{ $today }}", type: "Variable", documentation: "The current day (minus the time)" }
        ]
    };

    var _editor;
    var _completor;
    var _saveHandlers = [];
    var _validationDirty = false;
    var _changeHandler = null;
    var _tooltipElement = document.createElement("div");
    var _uuidRegex = /.*?([a-fA-F0-9]{8}\-(?:[a-fA-F0-9]{4}\-){3}[a-fA-F0-9]{12}).*/;
    var _validationCallback = [];
    var _lookupApi = [
        SanteDB.resources.entity,
        SanteDB.resources.concept,
        SanteDB.resources.conceptSet
    ];
    const _syntaxErrorRegex = /^(.*)\(line\s(\d+)\scolumn\s(\d+)\).*$/;
    const jsonTypeExtractor = /"\$type"\s*\:\s*\"(\w+)\"/mi;

    // Require
    var LanguageTools = ace.require("ace/ext/language_tools");
    var Range = ace.require("ace/range").Range;
    var { HoverTooltip } = ace.require("ace/tooltip");
    var { TokenIterator } = ace.require("ace/token_iterator");


    // Consume the token name
    function consumeTokenName(tokenIterator, keepRow) {
        // Move to the "STRING"
        var tokenType = null;
        var rt = null;
        while (tokenIterator.stepBackward()) {
            var currentToken = tokenIterator.getCurrentToken();
            if (keepRow === undefined || keepRow === tokenIterator.$row) {
                switch (currentToken.type) {
                    case "variable":
                        return { name: currentToken.value.trim().replaceAll("\"", ""), type: tokenType, resourceType: rt };
                    case "paren.lparen":
                        tokenType = currentToken.value.trim();
                        break;
                    case "paren.rparen": // Consume
                        consumeObjectTokens(tokenIterator);
                        break;
                }
            }
        }
    }

    // Consume all token objects from the iterator
    function consumeObjectTokens(tokenIterator) {
        while (tokenIterator.stepBackward()) {
            var currentToken = tokenIterator.getCurrentToken();
            switch (currentToken.type) {
                case "paren.rparen":
                    consumeObjectTokens(tokenIterator);
                    break;
                case "paren.lparen":
                    return;
            }
        }
    }

    async function getSchemaCompleteData(session, row, column, forDocumentation) {
        try {
            var definition = _editor.getValue();

            var _scopedList = null;
            // Attempt to extract the "$type" from the definition
            var match = jsonTypeExtractor.exec(definition);
            var api = null;
            if (match) {
                var type = match[1].toCamelCase();
                var api = SanteDB.resources[type];
            }

            if (api) {
                var tokenIterator = new TokenIterator(session, row, column);
                // Var token extractor - 
                var tokenPath = [];
                var lastString = null;
                var cObjectType = null;
                var lastVariable = null;
                while (tokenIterator.stepBackward()) {
                    var currentToken = tokenIterator.getCurrentToken();
                    switch (currentToken.type) {
                        case "paren.lparen":
                            // Get property
                            var tokenData = consumeTokenName(tokenIterator);
                            if (tokenData) {
                                tokenData.castAs = cObjectType;
                            }
                            tokenPath.push(tokenData);
                            break;
                        case "paren.rparen":
                            consumeObjectTokens(tokenIterator);
                            consumeTokenName(tokenIterator); // Get the token name
                            break;
                        case "string":
                            lastString = currentToken.value;
                            break;
                        case "variable":
                            if (currentToken.value == '"$type"') {
                                cObjectType = lastString.replaceAll("\"", "");
                            }
                            else {
                                lastVariable = currentToken.value;
                            }
                    }
                }
                // Translate the token 
                tokenPath = tokenPath.reverse().filter(o => o !== undefined && o.name !== undefined);
                var expressionPath = "";
                if (tokenPath.length > 1) {
                    expressionPath = tokenPath.reduce((o, c, i) => {
                        var retVal = "";
                        if (c.type == "[") // Guard
                        {
                            retVal = `${o.name || o}[${c.name}]`;
                        }
                        else {
                            retVal = `${o.name || o}.${c.name}`;
                        }

                        if (c.castAs && i == tokenPath.length - 1) {
                            retVal += `@${c.castAs}`;
                        }
                        return retVal;
                    });
                }
                else if (tokenPath.length == 1) {
                    expressionPath = tokenPath[0].name;
                }

                if (!forDocumentation && (expressionPath.endsWith("Model") || expressionPath.indexOf("@") > -1)) {
                    expressionPath += "."; // HACK: The auto complete
                }

                var schemaComplete = await SanteDB.resources[type].invokeOperationAsync(null, "schema-complete", { expression: expressionPath }, false);

                // Does the current path have any classifier values?
                if (schemaComplete.properties) {
                    var myProperty = tokenPath.length == 0 ? null : schemaComplete.properties.find(o => o.name == tokenPath[tokenPath.length - 1].name);
                    if (myProperty && myProperty.classifierValues) {
                        _scopedList = myProperty.classifierValues.map(o => { return { name: o, type: "Classifier" } });
                    }
                    else {
                        // All properties can have a Model 
                        schemaComplete.properties.filter(o => o.delayLoadable).forEach(r => {
                            schemaComplete.properties.push({
                                name: `${r.name}`,
                                type: "Guid",
                                values: r.values,
                                documentation: r.documentation
                            });
                            r.name += "Model";
                            r.values = null;
                        });
                        _scopedList = schemaComplete.properties;
                    }
                }
            }
            else {
                // TODO: call a symbol lookup function here
                _scopedList = [{ name: "$type" }];
            }
            return _scopedList;
        } catch (e) {
            console.error(e);
        }
    }

    async function _validateEditor(force) {
        try {
            if (force !== true && !_validationDirty) {
                return;
            }

            var value = _editor.getValue();
            _validationDirty = false;

            var issues = {
                issue: []
            };
            var model = null;
            try {
                model = JSON.parse(value);
                if (model && !model.$type) {
                    issues.issue.push({
                        row: 0,
                        column: 1,
                        text: "Missing $type on your model",
                        type: "Error"
                    });
                }
            }
            catch (e) {
                if (e instanceof SyntaxError) {
                    var match = _syntaxErrorRegex.exec(e.message);
                    if (match) {
                        issues.issue.push({
                            row: match[2],
                            column: match[3],
                            text: match[1],
                            type: "error"
                        });
                    }
                    else {
                        issues.issue.push({
                            row: 1,
                            column: 1,
                            text: e.message,
                            type: "error"
                        })
                    }
                }
            }



            var isValid = issues.issue.find(o => o.priority == 'Error') == null;
            _editor.getSession().clearAnnotations();
            annotations = issues.issue.map(i => {
                if (!i.refersTo || i.refersTo.indexOf("@") == -1) {
                    return {
                        row: i.row || 0,
                        column: i.column || 1,
                        text: i.text,
                        type: i.type || i.priority == "Error" ? "error" : i.priority == "Warning" ? "warn" : "info"
                    }; // doesn't apply
                }
                else if (i.row && i.column)
                    return {
                        row: parseInt(ln[0]) - 1,
                        column: parseInt(ln[1]),
                        text: i.text,
                        type: i.priority == "Error" ? "error" : i.priority == "Warning" ? "warning" : "info"
                    };
            });
            _editor.getSession().setAnnotations(annotations);
            _validationCallback.forEach(o => o(annotations));
            return isValid;
        }
        catch (e) {
            console.error(e);
            return false;
        }

    }

    // RIM based auto complete
    function _rimCompletor() {

        var _basicTypes = Object.keys(SanteDB.resources).filter(o => SanteDB.resources[o] instanceof ResourceWrapper).map(o => { return { name: SanteDB.resources[o].getResource(), type: "Resource" } });
        var _completeCache = {};

        this.getCompletions = async function (editor, session, pos, prefix, callback) {

            var tokenIterator = new TokenIterator(session, pos.row, pos.column);
            var token = tokenIterator.getCurrentToken();

            var _scopedList = await getSchemaCompleteData(session, pos.row, pos.column);

            if (token.type !== "variable") {
                var variableName = consumeTokenName(tokenIterator, pos.row);
                if (variableName && variableName.name == "$type") {
                    _scopedList = _basicTypes;
                } else if (_scopedList) {
                    var fnVar = variableName === undefined ? null : _scopedList.find(c => c.name == variableName.name);
                    if (fnVar) {
                        var modelVar = _scopedList.find(c => c.name == `${variableName.name}Model`);
                        if (fnVar.values) {
                            _scopedList = Object.keys(fnVar.values).map(o => { return { name: fnVar.values[o], value: o, type: "Concept" } });
                        }
                        else {
                            _scopedList = [];
                        }

                        for (var i in _sysVars[fnVar.type] || []) {
                            _scopedList.push(_sysVars[fnVar.type][i]);
                        }

                        // For GUID we need to also provide lookup data - so let's do that
                        if (!fnVar.values && modelVar) {
                            var query = { _count: 10, _includeTotal: false };
                            switch (modelVar.type) {
                                case Concept.name:
                                    query["name.value||mnemonic"] = `~${token.value.replaceAll("\"", "")}`;
                                    break;
                                case Entity.name:
                                    query["name.component.value"] = `~${token.value.replaceAll("\"", "")}`;
                                    break;
                            }

                            var api = SanteDB.resources[modelVar.type.toCamelCase()];
                            if (Object.keys(query).length > 2 && api) {
                                if (api) {
                                    var matches = await api.findAsync(query, "dropdown");
                                    if (matches.resource) {
                                        matches.resource.map(r => {
                                            return {
                                                name: r.$type == "Concept" ? SanteDB.display.renderConcept(r) : SanteDB.display.renderEntityName(r.name),
                                                value: r.id,
                                                type: r.$type, 
                                                documentation: r.mnemonic
                                            }
                                        }).forEach(r=>_scopedList.push(r));
                                    }
                                }
                            }
                        }
                    }

                }
            }

            if (_scopedList) {
                var tokenValue = token.value.trim().replaceAll("\"", "");
                var results = _scopedList.filter(sc => {
                    return sc.name && sc.name.indexOf(tokenValue.substring(1) == 0)
                }).map((result) => {
                    return {
                        value: result.value || result.name,
                        caption: result.name,
                        score: 1,
                        docText: result.documentation ? result.documentation.trim() : "No Documentation",
                        meta: result.type || "Other"
                    }
                });
                callback(null, results);
            }
        }


        // this.getDocTooltip = function(item) {
        //     var itm = _currentScopeList.symbol.find(o=>o.name == item.name);
        //     if(itm  && itm.documentation) {
        //         return itm.documentation;
        //     }
        // }
    };

    function _initializeEditor(controlName, templateDefinition) {
        // Initialize the editor
        _editor = ace.edit(controlName, {
            theme: "ace/theme/sqlserver",
            mode: "ace/mode/json",
            wrap: true,
            maxLines: window.innerHeight / 27,
            minLines: 20,
            hasCssTransforms: true,
            value: templateDefinition.template.content,
            keyboardHandler: "ace/keyboard/vscode",
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true
        });
        _editor.getSession().on('change', () => {
            _validationDirty = true;
            if (_changeHandler) {
                _changeHandler(_editor.getValue());
            }
        });
        _completor = new _rimCompletor();
        LanguageTools.setCompleters([_completor]);
        _addSaveKeyboardShortcut();
        _addHelpTooltip();
    }


    // TODO: Add a callback to a model validator
    function _addSaveKeyboardShortcut() {
        _editor.commands.addCommand({
            name: 'save',
            bindKey: { win: 'Ctrl-S', mac: "Cmd-S" },
            exec: async function (editor) {
                var valid = await _validateEditor(true);
                if (!valid) {
                    toastr.error(SanteDB.locale.getString("ui.admin.emr.templates.rim.invalid"));
                }
                else {
                    try {
                        await SanteDB.resources.dataTemplateDefinition.checkoutAsync(templateDefinition.id, true);

                        _editor.setReadOnly(true);
                        var patch = new Patch({
                            appliesTo: {
                                id: templateDefinition.id,
                                type: "DataTemplateDefinition"
                            },
                            change: [
                                {
                                    op: PatchOperationType.Replace,
                                    path: "template.content",
                                    value: _editor.getValue()
                                }
                            ]
                        })
                        SanteDB.resources.dataTemplateDefinition.patchAsync(templateDefinition.id, null, patch);
                        _editorDirty = false;
                        toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.save.success"));
                        _saveHandlers.forEach(o => o());
                    }
                    catch (e) {
                        if (e.message) {
                            alert(e.message);
                        }
                        else {
                            alert(e);
                        }
                    }
                    finally {
                        _editor.setReadOnly(false);
                    }
                }
            }
        })
    }

    function _addHelpTooltip() {
        // Documentation tooltip
        var docToolTip = new HoverTooltip();
        var _lastLookupSymbol = null;
        docToolTip.setDataProvider(async function (e, editor) {
            var session = editor.session;
            var docPosition = e.getDocumentPosition();

            // Get the word rage
            var wordRange = session.getWordRange(docPosition.row, docPosition.column);
            var token = session.getTokenAt(docPosition.row, docPosition.column);

            if (token.value != _lastLookupSymbol) {
                _lastLookupSymbol = token.value;

                // Now we want to fetch documentation for the keyword - or we want to lookup what a UUID might be
                if (_uuidRegex.test(token.value)) {
                    var results = _uuidRegex.exec(token.value);
                    try {
                        var refConcept = await Promise.all(
                            _lookupApi.map(async function (a) {
                                var res = await a.findAsync({ id: results[1] });
                                if (res.resource) {
                                    return res.resource[0];
                                }
                                else {
                                    return null;
                                }
                            })
                        );
                        refConcept = refConcept.find(rc => rc !== null);

                        if (refConcept) {
                            var helpHtml = `<strong>${refConcept.$type}</strong>: `;
                            switch (refConcept.$type) {
                                case "Concept":
                                    helpHtml += `${SanteDB.display.renderConcept(refConcept)} <em>(${refConcept.mnemonic})</em>`;
                                    break;
                                case "ConceptSet":
                                    helpHtml += refConcept.name;
                                    break;
                                case "Entity":
                                case "Patient":
                                case "Place":
                                case "Material":
                                case "ManufacturedMaterial":
                                case "Person":
                                    if (refConcept.name) {
                                        helpHtml += SanteDB.display.renderEntityName(refConcept.name);
                                    } if (refConcept.typeConceptModel) {
                                        helpHtml += ` <em>(${refConcept.typeConceptModel.mnemonic})</em>`;
                                    }
                                    break;
                            }
                            _tooltipElement.innerHTML = helpHtml;
                        }
                        else {
                            _tooltipElement.innerHTML = "Unknown";
                        }
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
                else {
                    var _symbolList = await getSchemaCompleteData(session, docPosition.row, docPosition.column, true);

                    var value = _symbolList.find(c => c.name == token.value.replaceAll("\"", "").trim());
                    if (value) {
                        _tooltipElement.innerHTML = value.documentation ? value.documentation.trim() : "No Documentation";
                    }
                    else {
                        _tooltipElement.innerHTML = token.value;
                    }
                }
            }
            docToolTip.showForRange(editor, wordRange, _tooltipElement, e);
        });

        docToolTip.addToEditor(_editor);

    }

    // Perform initialization
    _initializeEditor(controlName, templateDefinition);

    this.getValue = function () {
        return _editor.getValue();
    }
    this.clearAnnotations = function () {
        _editor.getSession().clearAnnotations();
    }
    this.setAnnotations = function (annotations) {
        _editor.getSession().setAnnotations(annotations);
        _validationCallback.forEach(o => o(annotations));
    }
    this.onChange = function (changeHandler) {
        _changeHandler = changeHandler;
    }
    this.onSave = function (saveHandler) {
        _saveHandlers.push(saveHandler);
    }
    this.onAnnotationChange = function (callback) {
        _validationCallback.push(callback);
    }
    this.setReadonly = function (readonly) {
        _editor.setReadonly(readonly);
    }
    this.gotoIssue = function (issue) {
        _editor.gotoLine(issue.row + 1, issue.column);
    }
    this.validateEditor = function () {
        _validateEditor();
    }
}