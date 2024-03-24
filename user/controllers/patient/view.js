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
angular.module('santedb').controller('EmrPatientViewController', ["$scope", "$rootScope", "$state", "$templateCache", "$stateParams", function ($scope, $rootScope, $state, $templateCache, $stateParams) {

    // Loads the specified patient
    async function loadPatient(id) {
        try {
            var er = await SanteDB.resources.entityRelationship.findAsync({ 
                "relationshipType": "97730a52-7e30-4dcd-94cd-fd532d111578", // MDM
                "source" : id // Where this is the holder
            }, "reverseRelationship");

            // If the patient is an MDM 
            if(er.resource && er.resource.length > 0 && er.resource[0].target != id) {
                var params = angular.copy($stateParams);
                params.id = er.resource[0].target;
                $state.transitionTo($state.$current.name, params);
                return;
            }
            $scope.patient = await SanteDB.resources.patient.getAsync(id, "full");
        }
        catch (e) {
            // Remote patient perhaps?
            if (e.$type == "FileNotFoundException" || e.cause && e.cause.$type == "FileNotFoundException") {
                try {

                    $scope.patient = await SanteDB.resources.patient.getAsync({ id: id, _upstream: true }, "full");
                    $scope.patient._upstream = true;
                    if ($scope.patient.tag) {
                        delete $scope.patient.tag["$mdm.type"];
                        delete $scope.patient.tag["$altkeys"];
                        delete $scope.patient.tag["$generated"];
                    }
                    
                    return;
                }
                catch (e) {
                    $scope.error = $rootScope.prepareErrorForDisplay(e);
                }
            }
            $scope.error = $rootScope.prepareErrorForDisplay(e);

        }
        finally {
            try { $scope.$apply(); }
            catch(e) {}
        }
    }
    loadPatient($stateParams.id);


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
