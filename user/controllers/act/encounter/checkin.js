/// <reference path="../../../.ref/js/santedb.js" />
angular.module('santedb').controller('EmrCheckinEncounterController', ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

    $scope.patientId = null;
    $scope.$watch("patientId", async function (n, o) {
        if (n && n != o) {
            try {
                var fetchedData = await Promise.all([
                    SanteDB.resources.patient.getAsync(n, "full"),
                    SanteDB.resources.patientEncounter.findAsync({ 
                        "participation[RecordTarget].player" : n, 
                        moodConcept: ActMoodKeys.Propose, 
                        _count: 1, 
                        actTime: [ 
                            `>=${moment().add(-10, 'days').format('YYYY-MM-DD')}`, 
                            `<=${moment().add(5, 'days').format('YYYY-MM-DD')}` 
                        ], 
                        _includeTotal: false 
                    }, 'full'), 
                    SanteDB.resources.patientEncounter.findAsync({
                        "participation[RecordTarget].player" : n, 
                        moodConcept: ActMoodKeys.Appointment,
                        _count: 1,
                        actTime: `~${moment().format('YYYY-MM-DD')}`,
                        _includeTotal: false
                    })
                ]);

                $timeout(() => {
                    $scope.recordTarget = new Patient(fetchedData.find(d=>d.$type == "Patient"));
                    $scope.newAct = new PatientEncounter();
                    var tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].moodConcept == ActMoodKeys.Propose);
                    if(tArray.length > 0) {
                        $scope._proposedAct = new PatientEncounter(tArray[0].resource[0]);
                    }
                    tArray = fetchedData.filter(d => d.$type == "Bundle" && d.resource && d.resource[0].moodConcept == ActMoodKeys.Appointment);
                    if(tArray.length > 0) {
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

    $scope.applyGuardExpression = function (data) {
        if (data.guard) {
            return $scope.$eval(data.guard, { recordTarget: $scope.recordTarget });
        }
        return true;
    }

    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;

    $("#checkinModal").on("hidden.bs.modal", function () {
        $timeout(() => {
            $scope.patientId = "";
            delete ($scope.recordTarget);
            delete ($scope.encounter);
        });
    });
}]);