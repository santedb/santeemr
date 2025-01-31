/// <reference path="../../.ref/js/santedb.js"/>
/// <reference path="../../.ref/js/santedb-model.js"/>
/*
 * Portions Copyright 2015-2019 Mohawk College of Applied Arts and Technology
 * Portions Copyright 2019-2019 SanteSuite Contributors (See NOTICE)
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
 * User: Justin Fyfe
 * Date: 2019-9-27
 */
angular.module('santedb').controller('EmrPatientViewController', ["$scope", "$rootScope", "$state", "$stateParams", "$timeout", function ($scope, $rootScope, $state, $stateParams, $timeout) {

    async function getCdsAlerts(patientId){
        try {
            var issues = await SanteDB.resources.patient.invokeOperationAsync(patientId, "analyze", { _excludePropose: true });
            var issueTypes = {};
            issues.issue.forEach(o=> issueTypes[o.type] = null);
            await Promise.all(
                Object.keys(issueTypes).map(async (f) => {
                    var concept = await SanteDB.resources.concept.getAsync(f === EmptyGuid ? '1a4ff986-f54f-11e8-8eb2-f2801f1b9fd1' : f);
                    issues.issue.filter(i => i.type === f).forEach(i => i.typeModel = concept);
                    return concept;
                })
            );

            return issues.issue.filter(i => i.id !== "error.cdss.exception");
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    // Loads the specified patient
    async function loadPatient(id) {
        try {
            var patient = await SanteDB.resources.patient.getAsync(id, "full");

            // Post the patient to the AngularJS scope and then load the patient encounter
            $timeout(() => {
                $scope.patient = new Patient(patient);
            });

            // Attempt to get any current encounter
            var encounter = await SanteDB.resources.patientEncounter.findAsync({
                "participation[RecordTarget].player": id,
                statusConcept: StatusKeys.Active,
                _count: 1,
                _includeTotal: false
            }, "full");
            if(encounter.resource) {
                $scope.patient._currentEncounter = encounter.resource[0];
            }

            // Detect any alerts from the CDSS 
            var issues = await getCdsAlerts(id);
            $timeout(() => {
                $scope.cdssAlerts = {
                    priority: issues.sort((a, b) => {
                        switch(a.priority) {
                            case "Information": a.priorityVal = 1; break;
                            case "Warning": a.priorityVal = 2; break;
                            case "Error": a.priortyVal = 3; break;
                        }
                        switch(b.priority) {
                            case "Information": b.priorityVal = 1; break;
                            case "Warning": b.priorityVal = 2; break;
                            case "Error": b.priortyVal = 3; break;
                        }
                        return a.priortyVal > b.priorityVal ? -1 : 1;
                    })[0].priority,
                    issues: issues
                };
            })
        }
        catch (e) {

            var rootCause = e.getRootCause();

            // TODO: --- HANDLE ELEVATION CASE
            // Type of exception
            switch (rootCause.$type) {
                case "FileNotFoundException": // Try upstream
                case "KeyNotFoundException":
                    try {

                        var patient = await SanteDB.resources.patient.getAsync(id, "full", null, true);
                        patient._upstream = true;
                        if (patient.tag) {
                            delete patient.tag["$mdm.type"];
                            delete patient.tag["$altkeys"];
                            delete patient.tag["$generated"];
                        }
                        $timeout(() => $scope.patient = new Patient(patient));
                    }
                    catch (e) {
                        $timeout(() => $scope.error = $rootScope.prepareErrorForDisplay(e));
                    }
                    break;
                default:
                    $timeout(() => $scope.error = $rootScope.prepareErrorForDisplay(e));
                    break;
            }
        }
        finally {
            SanteDB.authentication.setElevator(null); // we got the patient successfully
        }
    }

    SanteDB.authentication.setElevator(new SanteDBElevator(loadPatient, false));
    loadPatient($stateParams.id);

    $scope.printCard = function () {
        window.print();
    }

    // Download the specified record by touching it
    $scope.downloadRecord = async function () {
        try {
            toastr.info(SanteDB.locale.getString("ui.emr.patient.downloading"));
            var localPatient = await SanteDB.resources.patient.copyAsync($stateParams.id);
            localPatient = await SanteDB.resources.patient.getAsync($stateParams.id);
            await SanteDB.resources.patient.updateAsync($stateParams.id, localPatient);
            toastr.info(SanteDB.locale.getString("ui.model.patient.saveSuccess"));
            $state.reload();
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }
}]);
