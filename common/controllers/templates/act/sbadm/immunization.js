
function __bindImmunizationScopeFunctions($scope, $rootScope) {

    $scope.newAntigen = {};

    $scope.filterExistingAntigens = function (i) {
        try {
            var entityName = SanteDB.display.renderEntityName(i.name, "Assigned");
            return $scope.table.data[entityName] === undefined;
        }
        catch (e) {
            return false;
        }
    }

    $scope.addDoseSequence = function () {
        const seq = $scope.table.cols[$scope.table.cols.length - 1] + 1;
        $scope.table.cols.push(seq);
        for (var k of Object.keys($scope.table.data)) {
            const antigen = $scope.table.data[k].map(o => o?.participation?.Product || [o._antigen]).find(o => Array.isArray(o))[0];

            $scope.table.data[k].push({
                _antigen: antigen.playerModel,
                _sequence: seq
            });
        }
    }

    $scope.addAntigen = function () {
        // Add an antigen of the specified type
        if (!$scope.newAntigen._player) return;

        // Grab the record target from another antigen

        const renderEntityName = SanteDB.display.renderEntityName($scope.newAntigen._player.name, "Assigned");
        $scope.table.data[renderEntityName] = $scope.table.cols.map(o => ({
            _antigen: o > 0 ? $scope.newAntigen._player : null,
            _sequence: o
        }));
        $scope.table.data[renderEntityName].$overrideAntigenCheck = true;
        // $scope.table.data[renderEntityName].$antigen = $scope.newAntigen._player;
        $scope.newAntigen._player = null;
    }

    $scope.addDoseManual = function (antigen, doseSequence) {
        const rct = $scope.acts.map(o => o.participation?.RecordTarget).filter(o => o)[0];
        var doseIdx = $scope.table.cols.indexOf(doseSequence);

        const template = new SubstanceAdministration({
            template: "50ac9b2d-e560-4b75-ac77-921bf0eceee8",
            moodConcept: "EC74541F-87C4-4327-A4B9-97F325501747",
            classConcept: "932A3C7E-AD77-450A-8A1F-030FC2855450",
            typeConcept: "0331e13f-f471-4fbd-92dc-66e0a46239d5",
            doseSequence: doseSequence,
            doseQuantity: 1,
            actTime: null,
            statusConcept: StatusKeys.Completed,
            participation: {
                Product: [
                    {
                        player: antigen.id
                    }
                ],
                RecordTarget: [
                    {
                        player: rct[0].player,
                        playerModel: rct[0].playerModel
                    }
                ]
            },
            tag: {
                "isBackEntry": true
            }
        });
        const renderEntityName = SanteDB.display.renderEntityName(antigen.name, "Assigned");
        const templateId = $scope.table.data[renderEntityName].map(o => o?.template).find(o => o);
        template.template = templateId;
        $scope.table.data[renderEntityName][doseIdx] = template;
        $scope.acts.push(template);

        // Add back to the scoped object 
        if ($rootScope.getParentVariable($scope, "addHistoryAct")) {
            $rootScope.getParentVariable($scope, 'addHistoryAct')(template);
        }
    }

}

angular.module("santedb").controller("HistoricalImmunizationEntryController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    __bindImmunizationScopeFunctions($scope, $rootScope);
    /// Groups the back-entry objects by their date and prepares it as a grid for the entry table
    function initialize() {

        // Link together our stored care plan with the updated care plan
        // We want to order the care plan HasComponents
        var maxSeq = $scope.acts.map(d => d.doseSequence || 0).reduce((a, b) => a > b ? a : b);
        var minSeq = $scope.acts.map(d => d.doseSequence || 0).reduce((a, b) => a < b ? a : b);

        if (minSeq > 1) {
            minSeq = 1
        };
        var colHeaders = [];
        for (var i = minSeq; i <= maxSeq; i++) colHeaders.push(i);


        // Next we want to generate buckets for the antigens
        const refNames = $scope.acts.filter(o => o.participation && o.participation.Product).groupBy(
            o => SanteDB.display.renderEntityName(o.participation.Product[0].playerModel.name, "Assigned"),
            o => o.participation.Product[0].playerModel
        );

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
            displayTable[antigenKey] = [];
            var recommendations = displayGrouping[antigenKey];
            for (var i = minSeq; i <= maxSeq; i++) {
                var doseSequence = recommendations.find(o => (o.doseSequence || 0) == i);
                displayTable[antigenKey].push(doseSequence || {
                    _antigen: i > 0 ? refNames[antigenKey][0] : null,
                    _sequence: i
                });
            }
        });

        $scope.table = {
            cols: colHeaders,
            data: displayTable
        };
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
                    const inputName = `vacc-history-${antigenKey}-${otherSubstanceAdmin.doseSequence}`,
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
}]).controller("HistoricalBoosterImmunizationEntryController", ["$scope", "$rootScope", "$timeout", "$state", function ($scope, $rootScope, $timeout, $state) {

    __bindImmunizationScopeFunctions($scope, $rootScope);

    /// Groups the back-entry objects by their date and prepares it as a grid for the entry table
    function initialize() {

        // Any dose sequences that are 0 are those need us to select a dose 
        var acts = $scope.acts.filter(o => o.doseSequence > 0);

        // Link together our stored care plan with the updated care plan
        // We want to order the care plan HasComponents
        if (acts.length > 0) {
            var maxSeq = acts.map(d => d.doseSequence || 0).reduce((a, b) => a > b ? a : b);
            var minSeq = acts.map(d => d.doseSequence || 0).reduce((a, b) => a < b ? a : b);

            var colHeaders = [];
            for (var i = minSeq; i <= maxSeq; i++) colHeaders.push(i);

            // Next we want to generate buckets for the antigens
            var displayGrouping = acts.filter(o => o.participation && o.participation.Product).groupBy(
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

            $scope.table = {
                cols: colHeaders,
                data: displayTable
            };

        }
        $scope.unknownDoses = $scope.acts.filter(o => !o.doseSequence || o.doseSequence === 0);
    }

    initialize();
}]).controller("EmrImmunizationTemplateController", ["$scope", "$timeout", function ($scope, $timeout) {

    $scope.$watch("act.participation.Product[0].player", async function (n, o) {
        try {
            if (n && n != o) {
                const adms = await SanteDB.resources.substanceAdministration.findAsync({
                    "participation[RecordTarget].player": $scope.act.participation.RecordTarget[0].player,
                    "participation[Product].player": n,
                    "statusConcept": StatusKeys.Completed,
                    "isNegated": false,
                    _includeTotal: false
                }, "min");

                $timeout(() => {
                    if (adms.resource) {
                        $scope.act.doseSequence = adms.resource.map(o=>o.doseSequence).sort((a,b) => a > b ? -1 : 1)[0] + 1;
                    }
                    else {
                        $scope.act.doseSequence = 1;
                    }
                });

            }
        }
        catch(e) {
            console.warn(e);
        }
    });
}]);
