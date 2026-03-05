angular.module('santedb').controller('EmrPatientReplacedController', ['$scope', '$rootScope', '$timeout', "$state", function ($scope, $rootScope, $timeout, $state) {

    $scope.resolveSummary = $scope.resolveSummaryTemplate = (act) => {
        if(typeof act === "string") {
            return SanteEMR.resolveSummaryTemplate(act);
        }
        else if (act.templateModel?.mnemonic) {
            return SanteEMR.resolveSummaryTemplate(act.templateModel.mnemonic);
        }
        else if(act.$type === PatientEncounter.name) {
            return SanteEMR.resolveSummaryTemplate("org.santedb.emr.act.visit.general"); // fallback to generic template
        }
        else if(act.typeConcept === "f562e624-17ca-11eb-adc1-0242ac120002") // Patient registration actions
        {
            return SanteEMR.resolveSummaryTemplate("org.santedb.emr.act.visit.general"); // fallback to generic template
        }
    };

    $scope.toggleSelectAll = function(replace) {
        replace.targetModel.participation?.RecordTarget.filter(o => !o.actModel.tag || !o.actModel.tag['$pep.masked']).forEach(rt => rt._merge = replace._mergeAll);
    }

    $scope.mergeItem = async function(target, hostId) {

        var itemsToMerge = target.$type === EntityRelationship.name ? target.targetModel.participation.RecordTarget.filter(o=>o._merge).map(o => o.act) : [ target.act ]; 
        if(!confirm(SanteDB.locale.getString("ui.emr.replaced.clinicalHistory.mergeConfirm", { nItems: itemsToMerge.length, patient: SanteDB.display.renderEntityName($scope.scopedObject.name) }))) {
            return;
        }

        try {
            SanteDB.display.buttonWait($(`#btn${target.id}`), true);
            $(`#history${hostId} tbody button`).attr('disabled', 'disabled');
            
            // Invoke the move 
            await SanteDB.resources.act.invokeOperationAsync(null, "emr-change-rct", {
                toPatient: $scope.scopedObject.id,
                acts: itemsToMerge
            }, null, null, null, "application/json");

            toastr.success(SanteDB.locale.getString("ui.emr.replaced.clinicalHistory.mergeSuccess"));
            $state.reload();
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait($(`#btn${target.id}`), false);
            $(`#history${hostId} tbody button`).removeAttr('disabled');
        }
    }

    $scope.fetchHistory = async function (relationship) {

        try {

            if(relationship.targetModel?.participation?.RecordTarget) {
                return;
            }

            // Get all clinical history events which are associated to the patient
            const filter = {
                "participation[RecordTarget].player": relationship.target,
                "statusConcept": [StatusKeys.New, StatusKeys.Completed, StatusKeys.New],
                "moodConcept": ActMoodKeys.Eventoccurrence,
                "template" : "!null",
                _includeTotal: true
            };
            var historyFetched = await SanteDB.resources.act.findAsync(filter, "emr.actSummaryView");

            var history = historyFetched.resource || [];
            var ofs = historyFetched.resource?.length ?? 0;
            while (ofs < historyFetched.totalResults) {
                filter._offset = ofs;
                historyFetched = await SanteDB.resources.act.findAsync(filter, "emr.actSummaryView");
                historyFetched.resource?.forEach(e => history.push(e));
                ofs += historyFetched.resource?.length ?? 1;
            }

            // Filter out those acts which are contained in one another
            var compositeHistoryItems = history.filter(h => h.relationship?.HasComponent);
            compositeHistoryItems.forEach((h) => {
                h.relationship.HasComponent.forEach(hc => {
                    var idx = history.findIndex(o => o.id == hc.target);
                    if (idx > -1) {
                        history.splice(idx, 1);
                    }
                });
            });

            $timeout(() => {
                relationship._loaded = true;
                relationship.targetModel.participation = {
                    RecordTarget: history.map(o => {
                        const rv = new ActParticipation({
                            actModel: o,
                            act: o.id,
                            id: SanteDB.application.newGuid()
                        });
                        rv._import = true;
                        return rv;
                    })
                }
            });

            // HACK: Don't want to add livequery and binding to global DOM change would be too chatty with angular 
            var interval = null;
            interval = setInterval(() => {
                var expectedTable = $(`#history${relationship.target} tbody tr`);
                if(expectedTable.length == history.length) {
                    $(`#history${relationship.target}`).DataTable({
                        order: [[ 2, 'desc' ]],
                        columnDefs: [
                            {
                                targets: [0],
                                orderable: false
                            }
                        ]
                    });
                    clearInterval(interval);
                }
            }, 500)

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

}]);