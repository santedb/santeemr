/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller('EmrCheckinEncounterController', ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    $scope.patientId = null;
    $scope.$watch("patientId", async function (n, o) {
        if (n && n != o) {
            try {
                var today = new Date().trunc();

                var fetchedData = await Promise.all([
                    SanteDB.resources.patient.getAsync(n, "full"),
                    SanteDB.resources.carePlan.findAsync({
                        "participation[RecordTarget].player": n,
                        "relationship[HasComponent].target.actTime": [
                            `>=${moment().add(-30, 'days').format('YYYY-MM-DD')}`,
                            `<=${moment().add(30, 'days').format('YYYY-MM-DD')}`
                        ],
                        _orderBy: "actTime:desc",
                        _includeTotal: false
                    }, 'full'),
                    SanteDB.resources.patientEncounter.findAsync({
                        "participation[RecordTarget].player": n,
                        moodConcept: ActMoodKeys.Appointment,
                        _count: 1,
                        actTime: `~${moment().format('YYYY-MM-DD')}`,
                        _includeTotal: false
                    })
                ]);

                $timeout(() => {
                    $scope.recordTarget = new Patient(fetchedData.find(d => d.$type == "Patient"));
                    var pid = SanteDB.application.newGuid();
                    $scope.newAct = new PatientEncounter({
                        participation: {
                            Informant: [
                                {
                                    playerModel: new Person({
                                        id: pid,
                                        relationship:
                                        {
                                            $other: [
                                                { 
                                                    relationshipType: EntityRelationshipTypeKeys.FamilyMember,
                                                    source: $scope.recordTarget.id,
                                                    target: pid
                                                }
                                            ]
                                        },
                                        name: {
                                            Assigned: [
                                                {
                                                    component: {
                                                        "Given": []
                                                    }
                                                }
                                            ]
                                        }
                                    })
                                }
                            ]
                        }
                    });
                    var tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].$type == "CarePlan");
                    if (tArray.length > 0) {
                        $scope._proposedActs = tArray[0].resource.map(cp => {

                            var act = cp.relationship.HasComponent.map(o=>o.targetModel).find(enc => {
                                return (enc.startTime || enc.actTime).trunc() <= today && (enc.stopTime || enc.actTime).trunc() >= today || // start and stop time are in bound
                                    enc.actTime.isoWeek() == today.isoWeek() && enc.actTime.getFullYear() == today.getFullYear() 
                            });
                            act.pathway = cp.pathway;
                            act.pathwayModel = cp.pathwayModel;
                            return act;
                        });
                    }
                    else {
                        $scope._proposedActs = [];
                    }
                    tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].moodConcept == ActMoodKeys.Appointment);
                    if (tArray.length > 0) {
                        $scope._appointmentAct = new PatientEncounter(tArray[0].resource[0]);
                    }
                    $scope.newAct.$startType = 'manual';
                });
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    });

    async function saveCheckin(formData) {
        if (formData.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);

            var templateId = null;
            var pathway = null;
            var startTypeData = $scope.newAct.$startType.split('-');
            var fulfills = [];
            var fulfillmentTargets = [];

            switch (startTypeData[0]) {
                case "manual":
                    templateId = $scope.newAct.template;
                    break;
                case "proposed":
                    {
                        var idx = parseInt(startTypeData[1]);
                        pathway = $scope._proposedActs[idx].pathway;
                        templateId = $scope._proposedActs[idx].templateModel.mnemonic;
                        fulfills.push(new ActRelationship({
                            target: $scope._proposedActs[idx].id
                        }));
                        fulfillmentTargets = $scope._proposedActs[idx].relationship.HasComponent.map(o => new ActRelationship({
                            target: o.target,
                            targetModel: {
                                $type: o.targetModel.$type,
                                protocol: o.targetModel.protocol
                            }
                        }));
                        break;
                    }

            }

            var encounter = await SanteEMR.startVisitAsync(templateId, pathway, $scope.recordTarget.id, fulfills, fulfillmentTargets, $scope.newAct.participation.Informant[0]);
            toastr.success(SanteDB.locale.getString("ui.emr.encounter.checkin.success"));
            $state.go("santedb-emr.encounter.view", { id: encounter.id });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
        }
    }

    $scope.applyGuardExpression = function (data) {
        if (data.guard) {
            return $scope.$eval(data.guard, { recordTarget: $scope.recordTarget });
        }
        return true;
    }

    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.saveCheckin = saveCheckin;

    $("#checkinModal").on("hidden.bs.modal", function () {
        $timeout(() => {
            $scope.patientId = "";
            delete ($scope.recordTarget);
            delete ($scope.encounter);
        });
    });


}]).controller('EmrReturnWaitingRoomController', ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    $scope.saveEncounter = async function(form) {
        if(form.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);
            await SanteEMR.saveVisitAsync($scope.encounter);
            
            toastr.success(SanteDB.locale.getString("ui.emr.encounter.save.success"));
            $state.go("santedb-emr.encounter.dashboard");
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally{ 
            SanteDB.display.buttonWait("#btnSubmit", false);

        }
    }

}]).controller("EmrDischargeEncounterController", ["$scope", "$rootScope", "$timeout", "$state", function($scope, $rootScope, $timeout, $state) {

    // Set the appropriate discharge dispositions etc.
    $scope.$watch("encounter", function(n, o) {
        if(n && (!o || o.id != n.id)) {

            // Set the status of the encounter and everything else
            n.statusConcept = StatusKeys.Completed;
            delete n.statusConceptModel;
            if(n.relationship && n.relationship.HasComponent) {
                n.relationship.HasComponent.forEach(comp => {
                    if(comp.targetModel.previousVersion || 
                        comp.targetModel.participation &&
                        comp.targetModel.participation.Performer
                    ) {
                        comp.targetModel.statusConcept = StatusKeys.Completed;
                        delete comp.targetModel.statusConceptModel;
                        comp.targetModel.operation = BatchOperationType.InsertOrUpdate;
                    }
                    else {
                        comp.targetModel.operation = BatchOperationType.Delete;
                    }
                })
            }
        }
    });

    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;

    $scope.saveDischarge = async function(formData) {
        if(formData.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);

            // Save the discharge
            var savedEncounter = await SanteEMR.saveVisitAsync($scope.encounter);

            // Was this part of a pathway or CDSS proposal? 
            if($scope.encounter.relationship.Fulfills && 
                $scope.encounter.relationship.Fulfills[0].targetModel.moodConcept == ActMoodKeys.Propose
            ) { 
                
                var careplan = await SanteEMR.getCarePlanFromEncounter($scope.encounter.relationship.Fulfills[0].target);

                if(careplan) {
                    // Regenerate the careplan
                    careplan = await SanteDB.resources.patient.invokeOperationAsync($scope.encounter.participation.RecordTarget[0].player, "carepath-recompute", {
                        pathway: careplan.pathway
                    });
                    
                    var today = new Date().trunc();
                    
                    var nextProposedAction = careplan.relationship.HasComponent.map(o=>o.targetModel).filter(o=>o.actTime > today)[0];
                    if(nextProposedAction && confirm(SanteDB.locale.getString("ui.emr.encounter.discharge.bookAppointment.confirm"))) {
                        SanteEMR.showAppointmentBooking(nextProposedAction);
                    }
                }

            }
            // TODO: Show appointment booking modal if there is a next step
            $timeout(() => {
                $("#dischargeModal").modal('hide');
                $("#waitingRoomList").EntityList.refresh();
            });

            toastr.success(SanteDB.locale.getString("ui.emr.encounter.discharge.success"));

        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);
        }
    }
}]);