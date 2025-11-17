/// <reference path="../../../.ref/js/santedb.js" />
/// <reference path="../../../js/emr.js" />
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
angular.module('santedb').controller('EmrEncounterViewController', ["$scope", "$rootScope", "$timeout", "$state", "$stateParams", function ($scope, $rootScope, $timeout, $state, $stateParams) {

    async function initializeView(encounterId) {
        try {
            var encounter = await SanteDB.resources.patientEncounter.getAsync(encounterId, "emr.actDetail", null, null, null, {
                "X-SanteDB-EmitPrivacyError": "Redact,Nullify,Hash,Hide",
                "Pragma" : "no-cache",
                "Cache-Control" : $rootScope.system?.config?.integration?.mode == 'synchronize' ? null : "no-cache"
            });

            encounter.relationship = encounter.relationship || {};
            encounter.relationship.HasComponent = encounter.relationship.HasComponent || [];

            // Resolve the tags on the encounter
            if (encounter.extension && encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL]) {
                encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0] = await SanteDB.application.resolveReferenceExtensionAsync(encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0]);
            }

            // All participations are not touched
            if (encounter.relationship && encounter.relationship.HasComponent) {
                encounter.relationship.HasComponent.filter(o => o.targetModel).forEach(e => e.targetModel.operation = BatchOperationType.IgnoreInt);
            }

            // The ancounter policies
            if (encounter.policy) {
                await Promise.all(encounter.policy?.map(async (p) => {
                    try {
                        p.policyModel = await SanteDB.resources.securityPolicy.getAsync(p.policy);
                    }
                    catch (e) {

                    }
                }));
            }
            // TODO: Load the current act list and assign to the _HasComponent relationship
            $timeout(() => {
                $scope.encounter = encounter;
            });

            // Load the next states
            var stateId = encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0].id
            var targetStates = await SanteDB.resources.concept.findAsync({
                conceptSet: 'D46D45B3-4DB3-4641-ADFC-84A80B7D1637', // EMREncounterTags
                "id||relationship[StateFlow].source": stateId,
                "relationship[MemberOf].targetConcept": encounter.typeConcept,
                _includeTotal: false
            });

            // Default state 
            if (!targetStates.resource) {
                targetStates = await SanteDB.resources.concept.findAsync({
                    conceptSet: 'D46D45B3-4DB3-4641-ADFC-84A80B7D1637', // EMREncounterTags
                    "id||relationship[StateFlow].source": stateId,
                    _includeTotal: false
                })
            }

            encounter._nextStates = targetStates.resource.map(state => {
                state.icon = 'fas fa-fw fa-person-walking-arrow-loop-left';
                state.action = $scope.returnToState;
                state.label = SanteDB.display.renderConcept(state);
                return state;
            });

        }
        catch (e) {
            // TODO: HANDLE ELEVATION CASE
            $rootScope.errorHandler(e);
        }

    }

    var elevator = new SanteDBElevator(() => initializeView($stateParams.id), true);
    elevator.setCloseCallback((elevated) => {
        if (!elevated) {
            toastr.info(SanteDB.locale.getString("ui.emr.elevation.cancel"));
            $state.go("santedb-emr.dashboard");
        }
        else {
            toastr.success(SanteDB.locale.getString("ui.emr.elevation.success"));
        }
    });
    SanteDB.authentication.setElevator(elevator);
    initializeView($stateParams.id);
}]).controller("EmrEncounterEntryController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {
    async function cancelEncounter() {
        const encounterId = $scope.scopedObject.id;

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
                toastr.success(SanteDB.locale.getString("ui.emr.encounter.cancel.success"));

                $state.go("santedb-emr.encounter.dashboard");
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    }

    $scope.doQueue = () => SanteEMR.showRequeue($scope.scopedObject);

    $scope.doDischarge = async () => {
        try {

            var rct = $scope.scopedObject.participation.RecordTarget[0].player;
            SanteDB.display.buttonWait("#btnActEditdischarge", true);
            await SanteEMR.showDischarge($scope.scopedObject, $timeout, () => {
                $state.go("santedb-emr.patient.view", { id: rct });
            });
        }
        finally {
            SanteDB.display.buttonWait("#btnActEditdischarge", false);
        }
    }

    $scope.saveVisit = async function (form) {
        if (form.$invalid && !confirm(SanteDB.locale.getString("ui.emr.encounter.invalid.saveConfirm"))) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnActEditsave", true);
            await SanteEMR.saveVisitAsync($scope.scopedObject);
            toastr.success(SanteDB.locale.getString("ui.emr.encounter.save.success"));
            $state.reload();
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnActEditsave", false);
        }
    }

    $scope.doCancel = cancelEncounter;
}]);