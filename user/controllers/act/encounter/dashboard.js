/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller("EmrWaitingRoomController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    var _loadedFlowStates = {};
    async function cancelEncounter(encounterId) {
        if (confirm(SanteDB.locale.getString("ui.emr.encounter.cancel.confirm"))) {
            try {

                var submissionBundle = new Bundle({ resource: [] });
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

                await SanteDB.resources.bundle.insertAsync(submissionBundle);
                $("#waitingRoomList").EntityList.refresh();
                toastr.success(SanteDB.locale.getString("ui.emr.encounter.cancel.success"));

            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    }
   
    $scope.filterType = [];

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

    $scope.doDischarge = async function (r, idx) {

        try {
            SanteDB.display.buttonWait(`#waitingRoomList_action_discharge_${idx}`, true);
            var encounter = await SanteDB.resources.patientEncounter.getAsync(r, "full");
            await SanteEMR.showDischarge(encounter, $timeout);
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

                if (!$scope.filterFlow.find(f => f.id === extensionValue) && r.statusConcept != StatusKeys.Completed) {
                    $scope.filterFlow.push({
                        name: r.flowConceptModel.mnemonic,
                        id: extensionValue,
                        label: SanteDB.display.renderConcept(r.flowConceptModel),
                        action: $scope.doFilterFlow,
                        icon: 'fas fa-fw fa-circle',
                    });
                }
               
                if (!$scope.filterType.find(f => f.id === r.typeConcept)) {
                    $scope.filterType.push({
                        name: r.typeConcept,
                        id: r.typeConcept,
                        label: SanteDB.display.renderConcept(r.typeConceptModel),
                        action: $scope.doFilterType,
                        icon: 'fas fa-fw fa-circle'
                    });
                }


                return r;
            }
        }
        catch (e) {
            console.warn("cannot load flow state", e);
        }
    }

    $scope.doFilterFlow = function (parm, index) {
        $("#actionList_1 button").removeClass("active");
        $scope.filterByActState = null;
        $scope.filterByActDate = null;
        if (parm != $scope.filterByFlowState) {
            $scope.filterByFlowState = parm;
            $($("#actionList_1 button")[index]).addClass("active");
            $("#actionList_button_1").html($($("#actionList_1 button")[index]).html());
        }
        else {
            $scope.filterByFlowState = null;
            $("#actionList_button_1").html(`<i class='fas fa-fw fa-filter'></i> ${SanteDB.locale.getString("ui.action.filterFlow")}`);
        }
    }


    $scope.doFilterReleased = function (parm, index) {
        $("#actionList_1 button").removeClass("active");
        $scope.filterByFlowState = null;
        if (!$scope.filterByActState) {
            $scope.filterByActState = StatusKeys.Completed;
            $scope.filterByActDate = ':(age)<1d';
            $($("#actionList_1 button")[index]).addClass("active");
            $("#actionList_button_1").html($($("#actionList_1 button")[index]).html());
        }
        else {
            $scope.filterByActState = null;
            $scope.filterByActDate = null;
            $("#actionList_button_1").html(`<i class='fas fa-fw fa-filter'></i> ${SanteDB.locale.getString("ui.action.filterFlow")}`);
        }
    }


    $scope.doFilterType = function (parm, index) {
        $("#actionList_2 button").removeClass("active");
        if (parm != $scope.filterByType) {
            $scope.filterByType = parm;
            $($("#actionList_2 button")[index]).addClass("active");
            $("#actionList_button_2").html($($("#actionList_2 button")[index]).html());
        }
        else {
            $scope.filterByType = null;
            $("#actionList_button_2").html(`<i class='fas fa-fw fa-filter'></i> ${SanteDB.locale.getString("ui.action.filterType")}`);
        }
    }

    $scope.filterByFlowState = null;
    $scope.filterByType = null;
    $scope.filterFlow = [
        {
            name: 'Released',
            label: 'ui.emr.encounter.waitingRoom.filter.released',
            icon: 'fas fa-fw fa-arrow-turn-down fa-rotate-90',
            action: $scope.doFilterReleased
        }
    ];

}])