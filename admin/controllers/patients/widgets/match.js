/// <Reference path="../../../.ref/js/santedb.js" />
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
angular.module("santedb").controller("EmrMatchDashboardController", ["$scope", "$rootScope", "$state", "$templateCache", "$stateParams", function ($scope, $rootScope, $state, $templateCache, $stateParams) {


    // Render holder patient
    $scope.renderHolder = function(rowData) {
        if(rowData.holderModel) {
            return SanteDB.display.renderPatientAsString(rowData.holderModel, SanteDB.configuration.getAppSetting('aa.preferred')); // in mpi.js
        }
        else {
            SanteDB.resources.patient.getAsync(rowData.holder, 'min').then((d) => $(`div.${d.id.replace("-","_")}`).html(SanteDB.display.renderPatientAsString(d,  SanteDB.configuration.getAppSetting('aa.preferred'))))
                .catch(e=>$rootScope.errorHandler(e));
            return `<div style="min-width:20vw" class='${rowData.holder.replace("-", "_")}'><i class="fas fa-circle-notch fa-spin"></i> ${SanteDB.locale.getString("ui.wait")}</div>`;
        }
    }

    // Render target patient
    $scope.renderTarget = function(rowData) {
        if(rowData.targetModel) {
            return SanteDB.display.renderPatientAsString(rowData.targetModel, SanteDB.configuration.getAppSetting('aa.preferred')); // in mpi.js
        }
        else {
            SanteDB.resources.patient.getAsync(rowData.target, 'min').then((d) => $(`div.${d.id.replace("-","_")}`).html(SanteDB.display.renderPatientAsString(d,  SanteDB.configuration.getAppSetting('aa.preferred'))))
                .catch(e=>$rootScope.errorHandler(e));
            return `<div style="min-width:20vw"  class='${rowData.target.replace("-", "_")}'><i class='fas fa-circle-notch fa-spin'></i>  ${SanteDB.locale.getString("ui.wait")}</div>`;
        }
    }

    // Render strength column
    $scope.renderStrength = function(rowData) {
        return `${Math.round(rowData.strength * 100)}%`;
    }

    /**
     * Submit an "ignore" request for the specified relationship
     */
     $scope.ignore = async function(candidateId, m) {
        try {

            SanteDB.display.buttonWait(`#Patientignore${m}`, true);
            var candidate = await SanteDB.resources.entityRelationship.getAsync(candidateId, "min", null, true);
            await ignoreCandidateAsync(candidate.holder, candidate.target);
            $("#duplicatesTable").attr("newQueryId", true);
            $("#duplicatesTable table").DataTable().ajax.reload();
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait(`#Patientignore${m}`, false);
        }
    }

    /**
     * Submit a RESOLVE 
     */
    $scope.resolve = async function(candidateId, m) {
        try {
            SanteDB.display.buttonWait(`#Patientresolve${m}`, true);
            var candidate = await SanteDB.resources.entityRelationship.getAsync(candidateId, "min", null, true);
            await attachCandidateAsync(candidate.holder, candidate.target);
            $("#duplicatesTable table").DataTable().ajax.reload();
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait(`#Patientresolve${m}`, false);
        }
    }

}]);