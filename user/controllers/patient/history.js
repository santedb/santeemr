angular.module('santedb').controller('EmrPatientHistoryViewController', ["$scope", "$rootScope", "$state", "$stateParams", "$timeout", function ($scope, $rootScope, $state, $stateParams, $timeout) {
  // Initialize the view
    async function initialize() {     
        const heightWeightBackEntry = {};

        for (const act of $scope.$parent.acts) {
          const year = act.actTime.getFullYear();       
          const month = act.actTime.getMonth() + 1;    

          const paddedMonth = month < 10 ? '0' + month : month.toString();

          const monthYearKey = `${year}-${paddedMonth}`;

          heightWeightBackEntry[monthYearKey] = act;
        }

        $scope.heightWeightBackEntry = heightWeightBackEntry;
    }

    initialize();
}]);
