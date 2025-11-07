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
angular.module('santedb').controller('EmrCheckinEncounterController', ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    $scope.patientId = null;

    $scope.$watch("patientId", async function (n, o) {
        if (n && n != o) {
            try {
                var today = new Date().trunc();

                var fetchedData = await Promise.all([
                    SanteDB.resources.patient.getAsync(n, "full"),
                    // Find the careplan
                    SanteDB.resources.carePlan.findAsync({
                        "participation[RecordTarget].player": n,
                        "relationship[HasComponent].target.actTime": [
                            `>=${moment().add(-30, 'days').format('YYYY-MM-DD')}`,
                            `<=${moment().add(30, 'days').format('YYYY-MM-DD')}`
                        ],
                        _orderBy: "actTime:desc",
                        _includeTotal: false
                    }, 'full'),
                    // Find appointments 
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
                                
                            ]
                        }
                    });

                    if($scope.recordTarget.dateOfBirth.age() <= 14) {
                        $scope.newAct.participation.Informant.push({
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
                                });
                    }

                    var tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].$type == "CarePlan");
                    if (tArray.length > 0) {
                        $scope._proposedActs = tArray[0].resource.map(cp => {

                            var act = null;
                            if ($scope.encounterId) { // The user clicked a specific encounter
                                act = cp.relationship.HasComponent.map(o => o.targetModel).find(enc => enc.id == $scope.encounterId);
                            }
                            else {
                                act = cp.relationship.HasComponent.map(o => o.targetModel).find(enc => {
                                    return (enc.startTime || enc.actTime).trunc() <= today && (enc.stopTime || enc.actTime).trunc() >= today || // start and stop time are in bound
                                        enc.actTime.isoWeek() == today.isoWeek() && enc.actTime.getFullYear() == today.getFullYear()
                                });
                            }

                            if(act) {
                                act.pathway = cp.pathway;
                                act.pathwayModel = cp.pathwayModel;
                                return act;
                            }
                        }).filter(o=>o);
                    }
                    else {
                        $scope._proposedActs = [];
                    }
                    tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].moodConcept == ActMoodKeys.Appointment);
                    if (tArray.length > 0) {
                        $scope._appointmentAct = new PatientEncounter(tArray[0].resource[0]);
                    }

                    if ($scope.encounterId) {
                        var idx = $scope._proposedActs.indexOf($scope._proposedActs.find(o => o.id == $scope.encounterId));
                        $scope.newAct.$startType = `proposed-${idx}`;
                    }
                    else {
                        $scope.newAct.$startType = 'manual';
                    }
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
            SanteDB.display.buttonWait("#btnStartVisit", true);

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

            var encounter = await SanteEMR.startVisitAsync(templateId, pathway, $scope.recordTarget.id, fulfills, fulfillmentTargets, $scope.newAct.participation.Informant[0], $scope.newAct.templateObject);
            toastr.success(SanteDB.locale.getString("ui.emr.encounter.checkin.success"));
            $state.go("santedb-emr.encounter.view", { id: encounter.id });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnStartVisit", false);
        }
    }

    $scope.applyGuardExpression = function (data) {
        if (data.guard) {
            return $scope.$eval(data.guard, { recordTarget: $scope.recordTarget });
        }
        return true;
    }

    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.resolveSummary = $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.saveCheckin = saveCheckin;

    $("#checkinModal").on("hidden.bs.modal", function () {
        $timeout(() => {
            $scope.patientId = "";
            delete ($scope.recordTarget);
            delete ($scope.encounter);
        });
    });


}]).controller('EmrReturnWaitingRoomController', ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {


    $scope.saveEncounter = async function (form) {
        if (form.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnSubmit", true);
            await SanteEMR.saveVisitAsync($scope.encounter);

            toastr.success(SanteDB.locale.getString("ui.emr.encounter.save.success"));
            $state.go("santedb-emr.encounter.dashboard");
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnSubmit", false);

        }
    }

}]).controller("EmrDischargeEncounterController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    // Set the appropriate discharge dispositions etc.
    $scope.$watch("encounter", function (n, o) {
        if (n && (!o || o._tmpId != n._tmpId)) {

            // Set the status of the encounter and everything else
            n.statusConcept = StatusKeys.Completed;
            delete n.statusConceptModel;
            if (n.relationship && n.relationship.HasComponent) {
                n.relationship.HasComponent.forEach(comp => {
                    delete comp.targetModel.statusConceptModel;
                })
            }
        }
    });

    $scope.resolveSummary = $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;

    $scope.saveDischarge = async function (formData) {
        if (formData.$invalid) {
            return;
        }

        try {
            SanteDB.display.buttonWait("#btnEndVisit", true);

            $scope.encounter.stopTime = new Date();

            // Set the status of all items in the encounter
            $scope.encounter.relationship.HasComponent?.forEach(comp => {
                if (comp.targetModel.statusConcept !== StatusKeys.Completed) {
                    comp.targetModel.operation = BatchOperationType.Delete;
                }
            });

            // Save the discharge
            var savedEncounter = await SanteEMR.saveVisitAsync($scope.encounter, "Discharger");

            // Was this part of a pathway or CDSS proposal? 
            if ($scope.encounter.relationship.Fulfills &&
                $scope.encounter.relationship.Fulfills[0].targetModel.moodConcept == ActMoodKeys.Propose
            ) {
                var careplan = await SanteEMR.getCarePlanFromEncounter($scope.encounter.relationship.Fulfills[0].target);

                if (careplan) {
                    // Regenerate the careplan
                    careplan = await SanteDB.resources.patient.invokeOperationAsync($scope.encounter.participation.RecordTarget[0].player, "carepath-recompute", {
                        pathway: careplan.pathway
                    });
                    var today = new Date().trunc();
                    if (careplan.relationship?.HasComponent) {
                        var nextProposedAction = await SanteDB.resources.patientEncounter.findAsync({ id: careplan.relationship.HasComponent.map(o => o.targetModel).filter(o => o.actTime > today)[0]?.id }, "full");

                        if (nextProposedAction.resource[0] && confirm(SanteDB.locale.getString("ui.emr.encounter.discharge.bookAppointment.confirm"))) {
                            const afterAction = $("#dischargeModal").data('after-action');
                            $("#dischargeModal").data('deferAction', true);
                            SanteEMR.showAppointmentBooking(nextProposedAction.resource[0], $timeout, afterAction);
                        }
                    }
                }
            }

            $timeout(() => {
                $("#dischargeModal").modal('hide');
            });

            toastr.success(SanteDB.locale.getString("ui.emr.encounter.discharge.success"));
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnEndVisit", false);
        }
    }
}]);
