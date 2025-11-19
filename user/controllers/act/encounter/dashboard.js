/// <reference path="../../../.ref/js/santedb.js" />
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
angular.module('santedb').controller("EmrWaitingRoomController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    var _loadedFlowStates = {};
    async function cancelEncounter(encounterId) {
        if (confirm(SanteDB.locale.getString("ui.emr.encounter.cancel.confirm"))) {
            try {

                var submissionBundle = new Bundle({ resource: [], correlationId: encounterId });
                submissionBundle.resource.push(new PatientEncounter({
                    id: encounterId,
                    operation: BatchOperationType.DeleteInt
                }));

                var component = await SanteDB.resources.actRelationship.findAsync({
                    "source": encounterId,
                    "relationshipType": ActRelationshipTypeKeys.HasComponent
                });

                if (component.resource) {
                    component.resource.forEach(c => submissionBundle.resource.push(new Act({
                        id: c.target,
                        operation: BatchOperationType.DeleteInt
                    })));
                }

                await SanteDB.resources.bundle.insertAsync(submissionBundle, undefined, undefined, true);
                $("#waitingRoomList")[0].EntityList.refresh();
                toastr.success(SanteDB.locale.getString("ui.emr.encounter.cancel.success"));

            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    }

    async function initializeView() {
        try {
            
            var filterByLocation = await SanteDB.authentication.getCurrentFacilityId();

            var typeFilter = await SanteDB.resources.concept.invokeOperationAsync(null, "xref-use", {
                "xr-resource" : "PatientEncounter",
                "xr-query": `participation[Location].player=${filterByLocation}&moodConcept=EC74541F-87C4-4327-A4B9-97F325501747&statusConcept=${StatusKeys.Active}&statusConcept=${StatusKeys.Completed}`,
                "xr-select": "typeConcept"
            });

            var flowFilter = await SanteDB.resources.concept.findAsync({
                "conceptSet" : "d46d45b3-4db3-4641-adfc-84a80b7d1637", 
                "relationship[MemberOf].targetConcept" : typeFilter.resource?.map(o=>o.id),
                "_orderBy": "mnemonic:asc"
            }, "min");

            $timeout(() => {
                $scope.filterByLocation = filterByLocation;
                $scope.filterFlow = flowFilter.resource?.map(f => {
                    return {
                        name: f.mnemonic,
                        id: [ btoa(`2^${f.id.toLowerCase()}`), btoa(`2^${f.id.toUpperCase()}`) ],
                        label: SanteDB.display.renderConcept(f),
                        action: $scope.doFilterFlow,
                        icon: 'fas fa-fw fa-circle'
                    };
                }) || [];
                $scope.filterFlow.push({
                    name: 'Released',
                    label: 'ui.emr.encounter.waitingRoom.filter.released',
                    icon: 'fas fa-fw fa-arrow-turn-down fa-rotate-90',
                    action: $scope.doFilterReleased
                });

                $scope.filterType = typeFilter.resource?.map(r => {
                    return {
                        name: r.mnemonic,
                        id: r.id,
                        label: SanteDB.display.renderConcept(r),
                        action: $scope.doFilterType,
                        icon: 'fas fa-fw fa-circle'
                    }
                })
            })

        }
        catch(e) {
            console.warn(e);
        }
    }
   
    initializeView();

    $scope.resolveSummary = $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.doViewPatient = async function (r) {
        try {
            var patient = await SanteDB.resources.patient.findAsync({
                _includeTotal: false,
                _count: 1,
                "participation[RecordTarget].act": r
            }, "min");
            $state.go("santedb-emr.patient.view", { id: patient.resource[0].id });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }
    $scope.doCancel = cancelEncounter;

    $scope.doDischarge = async function (r, idx) {

        try {
            SanteDB.display.buttonWait(`#waitingRoomList_action_discharge_${idx}`, true);
            var encounter = await SanteDB.resources.patientEncounter.getAsync(r, "emr.actDetail");
            encounter.$preventReloadConcepts = true;
            await SanteEMR.showDischarge(encounter, $timeout, () => {
                $("#waitingRoomList")[0].EntityList.refresh();
            });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait(`#waitingRoomList_action_discharge_${idx}`, false);
        }
    }

    $scope.loadFlowState = async function (r) {
        try {
            if (r.extension && r.extension[ENCOUNTER_FLOW.EXTENSION_URL]) {

                var extensionValue = r.extension[ENCOUNTER_FLOW.EXTENSION_URL][0];
                r.flowConceptModel = _loadedFlowStates[extensionValue] || await SanteDB.application.resolveReferenceExtensionAsync(extensionValue);
                _loadedFlowStates[extensionValue] = r.flowConceptModel;
                return r;
            }
            else {
                return r;
            }
        }
        catch (e) {
            console.warn("cannot load flow state", e);
        }
    }

    $scope.doFilterFlow = function (parm, index) {
        $("#waitingRoomListactionList_1 button").removeClass("active");
        $scope.filterByActState = null;
        $scope.filterByActDate = null;
        if (parm != $scope.filterByFlowState) {
            $scope.filterByFlowState = parm;
            $($("#waitingRoomListactionList_1 button")[index]).addClass("active");
            $("#waitingRoomListactionList_button_1").html($($("#waitingRoomListactionList_1 button")[index]).html());
        }
        else {
            $scope.filterByFlowState = null;
            $("#waitingRoomListactionList_button_1").html(`<i class='fas fa-fw fa-filter'></i> ${SanteDB.locale.getString("ui.action.filterFlow")}`);
        }
    }


    $scope.doFilterReleased = function (parm, index) {
        $("#waitingRoomListactionList_1 button").removeClass("active");
        $scope.filterByFlowState = null;
        if (!$scope.filterByActState) {
            $scope.filterByActState = StatusKeys.Completed;
            $scope.filterByActDate = ':(age)<1d';
            $($("#waitingRoomListactionList_1 button")[index]).addClass("active");
            $("#waitingRoomListactionList_button_1").html($($("#waitingRoomListactionList_1 button")[index]).html());
        }
        else {
            $scope.filterByActState = null;
            $scope.filterByActDate = null;
            $("#waitingRoomListactionList_button_1").html(`<i class='fas fa-fw fa-filter'></i> ${SanteDB.locale.getString("ui.action.filterFlow")}`);
        }
    }


    $scope.doFilterType = function (parm, index) {
        $("#waitingRoomListactionList_2 button").removeClass("active");
        if (parm != $scope.filterByType) {
            $scope.filterByType = parm;
            $($("#waitingRoomListactionList_2 button")[index]).addClass("active");
            $("#waitingRoomListactionList_button_2").html($($("#waitingRoomListactionList_2 button")[index]).html());
        }
        else {
            $scope.filterByType = null;
            $("#waitingRoomListactionList_button_2").html(`<i class='fas fa-fw fa-filter'></i> ${SanteDB.locale.getString("ui.action.filterType")}`);
        }
    }

    $scope.filterByFlowState = null;
    $scope.filterByType = null;
}])