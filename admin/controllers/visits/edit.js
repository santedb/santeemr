/// <reference path="../../.ref/js/santedb.js"/>
/*
 * Copyright (C) 2021 - 2025, SanteSuite Inc. and the SanteSuite Contributors (See NOTICE.md for full copyright notices)
 * Portions Copyright (C) 2019 - 2021, Fyfe Software Inc. and the SanteSuite Contributors
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
 *
 */
angular.module('santedb').controller('EmrEditVisitTypesController', ["$scope", "$rootScope", "$timeout", "$state", "$stateParams", function ($scope, $rootScope, $timeout, $state, $stateParams) {

    mermaid.mermaidAPI.initialize({
        "theme": "neutral",
        maxTextSize: 1048576,
        stateDiagram: {
            width: '100%',
            useMaxWidth: false,
            htmlLabels: true
        }
    });

    var _refStates = {};

    async function initializeView(id) {
        try {
            var visitType = {
                concept: null,
                flowStates: []
            };

            var mt = await SanteDB.resources.concept.findAsync({ 'conceptSet.mnemonic': 'EMREncounterTags' }, 'concept');
            if (mt.resource) {
                mt.resource.forEach(m => _refStates[m.id] = m);
            }

            if (id) {
                visitType.concept = id;
                visitType.conceptModel = await SanteDB.resources.concept.getAsync(id, "full");
                var flows = await SanteDB.resources.conceptRelationship.findAsync({ targetConcept: id, relationshipType: ConceptRelationshipTypeKeys.MemberOf }, "reverseRelationship");
                visitType.flowStates = (flows.resource || []).map(c => c.sourceModel);
            }

            $timeout(() => $scope.visitType = visitType);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($stateParams.id);

    $scope.addFlowState = function (c) {
        if (!$scope.visitType.flowStates.find(s => s.id == c)) {
            $scope.visitType.flowStates.push(_refStates[c]);
        }
    }

    $scope.$watch("visitType.flowStates.length", function (n, o) {
        if (n && n != o) {

            var mermaidStr = "stateDiagram-v2\r\n";
            var tMap = $scope.visitType.flowStates.map(o => SanteDB.display.renderConcept(o));
            tMap.forEach((t, i) => mermaidStr += `\t${i}: ${t}\r\n`);
            $scope.visitType.flowStates.forEach(state => {

                var targets = [];
                var stateData = _refStates[state.id];
                if (stateData.relationship && stateData.relationship.StateFlow) {
                    targets = stateData.relationship
                        .StateFlow
                        .map(t => t.targetConcept)
                        .map(t => tMap.indexOf(SanteDB.display.renderConcept(_refStates[t]))).filter(t => t != -1);
                }
                else {
                    targets = ['[*]']; // terminal
                }
                var fromId = tMap.indexOf(SanteDB.display.renderConcept(state));
                targets.forEach(t => mermaidStr += `\t${fromId} --> ${t}\r\n`);
            });

            // Add start / terminal states
            tMap.forEach((t,i) => {
                var isTerminal = mermaidStr.indexOf(`${i} -->`) == -1; // Goes to no state
                var isStart = mermaidStr.indexOf(`--> ${i}`) == -1; // Comes from no state
                if(isStart) // Start state
                {
                    mermaidStr += `\t[*] --> ${i}\r\n`;
                }
                if(isTerminal) // terminal state
                {
                    mermaidStr += `\t${i} --> [*]\r\n`;
                }
            })
            (mermaidStr);
            mermaid.mermaidAPI.render("stateDiagram", mermaidStr, (svg) => {
                $("#stateDiagramSvg").html(svg);
            });
        }
    });

    $scope.saveVisitType = async function(form) {
        if(form.$invalid) { return; }

        try 
        {
            SanteDB.display.buttonWait("#btnSave", true);

            // Patch the type 
            var patch = new Patch({
                appliesTo: {
                    type: Concept.name,
                    id: $scope.visitType.concept
                },
                change: [
                    {
                        op: PatchOperationType.Add,
                        path: "conceptSet",
                        value: "42764da0-17be-11eb-adc1-0242ac120002"
                    }
                ]
            });

            await SanteDB.resources.concept.patchAsync($scope.visitType.concept, null, patch);
            // Flow states
            if($scope.visitType.flowStates) {
                var currentMembers = await SanteDB.resources.conceptRelationship.findAsync({ targetConcept: $scope.visitType.concept, relationshipType: ConceptRelationshipTypeKeys.MemberOf  });
                if(currentMembers.resource) {
                    await Promise.all(currentMembers.resource.map(o => SanteDB.resources.conceptRelationship.deleteAsync(o.id)));
                }

                await Promise.all($scope.visitType.flowStates.map(async function(st) {
                    try {
                        var isMember = await SanteDB.resources.conceptRelationship.findAsync({ source: st.id, targetConcept: $scope.visitType.concept, relationshipType: ConceptRelationshipTypeKeys.MemberOf, _count: 0, _includeTotal: true });
                        if(isMember.totalResults == 0) {
                            await SanteDB.resources.conceptRelationship.insertAsync(new ConceptRelationship({
                                source: st.id, 
                                targetConcept: $scope.visitType.concept,
                                relationshipType: ConceptRelationshipTypeKeys.MemberOf
                            }));
                        }
                    }
                    catch(e) {
                        console.warn(e);
                    }
                }));
            }

            toastr.success(SanteDB.locale.getString("ui.emr.admin.visitTypes.save.success"));
            $state.go("santedb-admin.emr.visits.index");
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally 
        {
            SanteDB.display.buttonWait("#btnSave", false);
        }
    }
}]);

