
angular.module("santedb").controller("HistoricalImmunizationEntryController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    /// Groups the back-entry objects by their date and prepares it as a grid for the entry table
    function initialize() {

        // Link together our stored care plan with the updated care plan
        // We want to order the care plan HasComponents
        var maxSeq = $scope.acts.map(d => d.doseSequence || 0).reduce((a, b) => a > b ? a : b);
        var minSeq = $scope.acts.map(d => d.doseSequence || 0).reduce((a, b) => a < b ? a : b);

        var colHeaders = [];
        for (var i = minSeq; i <= maxSeq; i++) colHeaders.push(i);

        // Next we want to generate buckets for the antigens
        var displayGrouping = $scope.acts.filter(o => o.participation && o.participation.Product).groupBy(
            o => SanteDB.display.renderEntityName(o.participation.Product[0].playerModel.name, "Assigned"),
            o => {
                o._urgency = o.stopTime < new Date() ? "pastdue" :
                    (o.startTime || o.actTime) < new Date() ? "now" :
                        o.startTime > new Date() ? "future" : null;
                return o;
            });

            
        var displayTable = {};
        Object.keys(displayGrouping).sort((a, b) => a > b ? 1 : -1).forEach(antigenKey => {
            var now = false;
            displayTable[antigenKey] = [];
            var recommendations = displayGrouping[antigenKey];
            for (var i = minSeq; i <= maxSeq; i++) {
                var doseSequence = recommendations.find(o => (o.doseSequence || 0) == i);
                displayTable[antigenKey].push(doseSequence);
            }
        });

        $timeout(() => {
            $scope.table = {
                cols: colHeaders,
                data: displayTable
            };
        })
    }

    $scope.getFormattedDate = (date) => {        
        return moment(date).format(SanteDB.locale.dateFormats.day);
    }

    $scope.dateSelectedUpdateColumn = (administrationAction) => {  
        const antigen = SanteDB.display.renderEntityName(administrationAction.participation.Product[0].playerModel.name, "Assigned"),
            doseIndex = administrationAction.doseSequence;            

        const currentAdm = $scope.table.data[antigen][doseIndex];        

        if (currentAdm) {
            currentAdm.isSelected = currentAdm.statusConcept == 'afc33800-8225-4061-b168-bacc09cdbae3';
        }
    
        if (administrationAction.actTime) {
            // Iterate through all antigen rows
            angular.forEach($scope.table.data, (antigenSubstanceAdministrations, antigenKey) => {
                // Skip the current row
                if (antigenKey === antigen) {
                    return;
                }
    
                const otherSubstanceAdmin = antigenSubstanceAdministrations[doseIndex];

                // Check if an immunization exists, has not yet been saved, and is pastdue or due now
                if (otherSubstanceAdmin && 
                    otherSubstanceAdmin.statusConcept != 'afc33800-8225-4061-b168-bacc09cdbae3' && 
                    (otherSubstanceAdmin._urgency === 'pastdue' || otherSubstanceAdmin._urgency === 'now')) {
                        const inputName =`vacc-history-${antigenKey}-${otherSubstanceAdmin.doseSequence}`,
                            input = $scope.$parent.ownerForm[inputName];

                        // Check if the input field exists on the form and is pristine
                        if (!input?.$pristine) {
                            return;
                        }
                    
                        // Will not set the date if it doesn't align with the min/max requirements
                        if (input.$$attr.min != '') {
                            if (!moment(administrationAction.actTime).isAfter(input.$$attr.min)) {
                                return;
                            }
                        }
                        
                        if (input.$$attr.max != '') {
                            if (!moment(administrationAction.actTime).isBefore(input.$$attr.max)) {
                                return;
                            }
                        }
                    
                        otherSubstanceAdmin.actTime = administrationAction.actTime;    
                }
            });
        }
    };

    initialize();
}]);
