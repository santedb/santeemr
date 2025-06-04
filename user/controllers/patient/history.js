angular.module('santedb').controller('EmrPatientHistoryViewController', ["$scope", "$rootScope", "$state", "$stateParams", "$timeout", function ($scope, $rootScope, $state, $stateParams, $timeout) {
  // Initialize the view
    async function initialize() {     
        const heightWeightBackEntry = {};

        const userEntityId = await SanteDB.authentication.getCurrentUserEntityId();
        const facilityId = await SanteDB.authentication.getCurrentFacilityId();        

        for (const act of $scope.$parent.acts) {            
          // Add facility to participant
          act.participation = act.participation || {};
          act.participation.Location = act.participation.Location || [];
          act.participation.Location.push(new ActParticipation({ player: facilityId }));
          
          act.participation.Authororiginator = act.participation.Authororiginator || [];
          act.participation.Authororiginator.push(new ActParticipation({ player: userEntityId }));

          act.tag = act.tag || {};
          act.tag.isBackEntry = ["true"];
          act.operation = BatchOperationType.InsertOrUpdate;

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
