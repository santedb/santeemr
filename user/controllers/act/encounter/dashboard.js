/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller('EmrEncounterDashboardController', ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {
}]).controller("EmrWaitingRoomController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    var _loadedFlowStates = {};
    async function cancelEncounter(encounterId) {
        if (confirm(SanteDB.locale.getString("ui.emr.encounter.cancel.confirm"))) {
            try {

                var submissionBundle = new Bundle({ resource: [] });
                submissionBundle.resource.push(new PatientEncounter({
                    id: encounterId,
                    operation: BatchOperationType.Delete
                }));

                var component = await SanteDB.resources.actRelationship.findAsync({
                    "source": encounterId,
                    "relationshipType": ActRelationshipTypeKeys.HasComponent
                });

                if (component.resource) {
                    component.resource.forEach(c => submissionBundle.resource.push(new Act({
                        id: c.target,
                        operation: BatchOperationType.Delete
                    })));
                }

                await SanteDB.resources.bundle.insertAsync(submissionBundle);
                $("#waitingRoomList").EntityList.refresh();
                toastr.success(SanteDB.locale.getString("ui.emr.encounter.cancel.success"));

            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    }
    $scope.filterByState = [];
    
    $scope.filterActions = [];

    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
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

    $scope.doDischarge = async function(r, idx) {

        try {
            SanteDB.display.buttonWait(`#waitingRoomList_action_discharge_${idx}`, true);
            var encounter = await SanteDB.resources.patientEncounter.getAsync(r, "full");
            SanteEMR.showDischarge(encounter);
        }
        catch(e) {
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

                if (!$scope.filterActions.find(f => f.id === r.flowConceptModel.id)) {
                    $scope.filterActions.push({
                        name: r.flowConceptModel.mnemonic,
                        id: extensionValue,
                        label: SanteDB.display.renderConcept(r.flowConceptModel),
                        action: $scope.doFilterResults,
                        icon: 'fas fa-fw fa-circle',
                    });
                }

                return r;
            }
        }
        catch (e) {
            console.warn("cannot load flow state", e);
        }
    }

    $scope.doFilterResults = function (parm, index) {
        $("#actionList_1 button").removeClass("active");
        if (parm != $scope.filterByState) {
            $scope.filterByState = parm;
            $($("#actionList_1 button")[index]).addClass("active");
            $("#actionList_button_1").html($($("#actionList_1 button")[index]).html());
        }
        else {
            $scope.filterByState = null;
            $("#actionList_button_1").html(`<i class='fas fa-fw fa-filter'></i> ${SanteDB.locale.getString("ui.action.filter")}`);
        }
    }

}])