
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

    initialize();
}]);