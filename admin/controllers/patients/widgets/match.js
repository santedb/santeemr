/// <Reference path="../../../.ref/js/santedb.js" />
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