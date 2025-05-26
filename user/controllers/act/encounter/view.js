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

        const careplanResponse = await SanteDB.resources.patient.invokeOperationAsync('576635b3-841e-4822-a856-9515fa8b963c', "generate-careplan", {
            asEncounters: false,
            library: "063fffad-fc37-4666-b949-4a96ae2a4fb9"
        });

        const heightWeightBackEntry = {},
            today = new Date();

        for (const act of careplanResponse.relationship.HasComponent) {
            if ((act.targetModel.templateModel.mnemonic === 'org.santedb.emr.observation.heightLying' || 
                act.targetModel.templateModel.mnemonic === 'org.santedb.emr.observation.weight') && act.targetModel.actTime < today) {
                    const year = act.targetModel.actTime.getFullYear();       
                    const month = act.targetModel.actTime.getMonth() + 1;    

                    const paddedMonth = month < 10 ? '0' + month : month.toString();

                    const monthYearKey = `${year}-${paddedMonth}`;

                    if (!heightWeightBackEntry[monthYearKey]) {
                        heightWeightBackEntry[monthYearKey] = [];
                    }
                    
                    heightWeightBackEntry[monthYearKey].push(act);
            }
        }    
        
        try {
            var encounter = await SanteDB.resources.patientEncounter.getAsync(encounterId, "full");

            // Resolve the tags on the encounter
            if(encounter.extension && encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL]) {
                encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0] = await SanteDB.application.resolveReferenceExtensionAsync(encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0]);
            }

            // All participations are not touched
            if(encounter.relationship && encounter.relationship.HasComponent) {
                encounter.relationship.HasComponent.forEach(e=> e.targetModel.operation = BatchOperationType.IgnoreInt );
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
            encounter._nextStates = targetStates.resource.map(state => {
                state.icon = 'fas fa-fw fa-person-walking-arrow-loop-left';
                state.action = $scope.returnToState;
                state.label = SanteDB.display.renderConcept(state);
                return state;
            });

        }
        catch(e) {
            // TODO: HANDLE ELEVATION CASE
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.authentication.setElevator(null);
        }
    }

    SanteDB.authentication.setElevator(new SanteDBElevator(initializeView, false));
    initializeView($stateParams.id);
}]).controller("EmrEncounterEntryController", ["$scope", "$rootScope", "$timeout", "$state", function($scope, $rootScope, $timeout, $state) {
    
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
    $scope.saveVisit = async function(form) {
        if(form.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnActEditsave", true);
            var encounter = await SanteEMR.saveVisitAsync($scope.scopedObject);
            if(encounter.extension && encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL]) {
                encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0] = await SanteDB.application.resolveReferenceExtensionAsync(encounter.extension[ENCOUNTER_FLOW.EXTENSION_URL][0]);
            }
            SanteDB.display.getScopeObject
            SanteDB.display.cascadeScopeObject($scope, ["encounter", "scopedObject"], encounter);
            toastr.success(SanteDB.locale.getString("ui.emr.encounter.save.success"));
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnActEditsave", false);
        }
    }
}]).controller("HistoricalImmunizationEntryController", ["$scope", "$rootScope", "$timeout", "$state", function($scope, $rootScope, $timeout, $state) {

    $scope.getIdentifier = (administrationAction) => {        
        const antigen = SanteDB.display.renderEntityName(administrationAction.participation.Product[0].playerModel.name, "Assigned");

        const rowIndex = Object.keys($scope.table.data).indexOf(antigen);
        const doseIndex = administrationAction.doseSequence;

        return rowIndex + '-' + doseIndex;
    }

    $scope.isDisabled = function(administrationAction) {           
        if (!administrationAction) {
            return true;
        }
        
        const antigenKey = SanteDB.display.renderEntityName(administrationAction.participation.Product[0].playerModel.name, "Assigned");
      
        const currentRowDoses = $scope.table.data[antigenKey];
        
        const currentDoseSequence = administrationAction.doseSequence;
        let minSequenceInRow = 0;
    
        for (let i = 0; i < currentRowDoses.length; i++) {
            const dose = currentRowDoses[i];

            if (dose) {
                minSequenceInRow = dose.doseSequence;
                break;
            }
        }
    
        // Enables the first dose in the sequence
        if (currentDoseSequence === minSequenceInRow) {
            return false;
        }
    
        // If not the first dose, check if ALL preceding doses have dates
        let allPrecedingAdministered = true;

        for (let i = minSequenceInRow; i < currentDoseSequence; i++) {
            const precedingDose = currentRowDoses[i];
            
            // Check if it's a valid dose, actually precedes the current one in sequence, and exists in the row
            if (precedingDose && precedingDose.doseSequence < currentDoseSequence) {
                // If a preceding dose is found WITHOUT a selected date, then the current dose cannot be enabled
                if (!precedingDose.isSelected || !precedingDose.selectedDate) {
                    allPrecedingAdministered = false;
                    break;
                }
            }
        }

        // Disable if any preceding dose was not administered, otherwise enable.
        return !allPrecedingAdministered;
    };

    $scope.dateSelectedUpdateColumn = (administrationAction) => {   
        const antigen = SanteDB.display.renderEntityName(administrationAction.participation.Product[0].playerModel.name, "Assigned"),
            doseIndex = administrationAction.doseSequence;

        const currentAdm = $scope.table.data[antigen][doseIndex];

        if (currentAdm) {
            currentAdm.isSelected = !!administrationAction.selectedDate;
        }
    
        if (administrationAction.selectedDate) {
            // Iterate through all antigen rows
            angular.forEach($scope.table.data, function(antigenSubstanceAdministrations, antigenKey) {
                // Skip the current row
                if (antigenKey === antigen) {
                    return;
                }
    
                const otherSubstanceAdmin = antigenSubstanceAdministrations[doseIndex];
                
                const form = $scope.$parent.$parent.$parent.$parent.$parent.panel.editForm;

                // Check if an immunization exists in the same column
                if (otherSubstanceAdmin && (otherSubstanceAdmin._urgency === 'pastdue' || otherSubstanceAdmin._urgency === 'now')) {
                    const rowIndex = Object.keys($scope.table.data).indexOf(antigenKey);

                    const inputName =`vacc-history-date-${rowIndex}-${otherSubstanceAdmin.doseSequence}`;                    
                    
                    // Check if the input field exists on the form and is pristine
                    if (form[inputName] && form[inputName].$pristine) {
                        otherSubstanceAdmin.selectedDate = administrationAction.selectedDate;
                    }
                }
            });
        }
    };

    function initialize() {
        $scope.table = $scope.$parent.immunizationHistoryTable;
    }

    initialize();
}]);
