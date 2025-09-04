using SanteDB;
using SanteDB.Core.BusinessRules;
using SanteDB.Core.Diagnostics;
using SanteDB.Core.Model.Acts;
using SanteDB.Core.Model.Constants;
using SanteDB.Core.Model.DataTypes;
using SanteDB.Core.Model.Query;
using SanteDB.Core.Security;
using SanteDB.Core.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace SanteEMR.Rules
{
    /// <summary>
    /// Patient status observation rule - indicates that a patient has a particular condition
    /// </summary>
    internal class PatientStatusObservationRule<TAct> : BaseBusinessRulesService<TAct> where TAct : Act
    {

        private readonly Tracer m_tracer = Tracer.GetTracer(typeof(PatientStatusObservationRule<TAct>));
        /// <summary>
        /// Concept repository
        /// </summary>
        private readonly IConceptRepositoryService m_conceptRepository;
        /// <summary>
        /// Persistence service
        /// </summary>
        private readonly IDataPersistenceService<TAct> m_persistenceService;
        private readonly IRepositoryService<CodedObservation> m_conditionRepository;

        /// <summary>
        /// DI constructor
        /// </summary>
        public PatientStatusObservationRule(IConceptRepositoryService conceptRepository, IDataPersistenceService<TAct> persistenceService, IRepositoryService<CodedObservation> codedObservationRepository)
        {
            this.m_conceptRepository = conceptRepository;
            this.m_persistenceService = persistenceService;
            this.m_conditionRepository = codedObservationRepository;
        }

        /// <summary>
        /// Intercept the act and ensure that we want to modify the current status
        /// </summary>
        public override TAct BeforeInsert(TAct data)
        {
            if (data == null)
            {
                throw new ArgumentNullException(nameof(data));
            }

            // Determine if the patient already has this observation type
            if (this.m_conceptRepository.IsMember(EmrConstants.PatientStatusObservation, data.TypeConceptKey.Value))
            {
                var rct = data.LoadProperty(o => o.Participations).FirstOrDefault(o => o.ParticipationRoleKey == ActParticipationKeys.RecordTarget);
                if (rct?.PlayerEntityKey != null)
                {
                    // determine if the patient already has an active observation for this status
                    var existing = this.m_persistenceService.Query(o => o.TypeConceptKey == data.TypeConceptKey.Value && o.Participations.Where(p => p.ParticipationRoleKey == ActParticipationKeys.RecordTarget).Any(p => p.PlayerEntityKey == rct.PlayerEntityKey) && o.ObsoletionTime == null, AuthenticationContext.SystemPrincipal).FirstOrDefault();
                    if (existing != null)
                    {
                        existing.StatusConceptKey = StatusKeys.Obsolete; // The old observation is now obsolete
                        data.LoadProperty(o => o.Relationships).Add(new ActRelationship(ActRelationshipTypeKeys.Replaces, existing)); // indicate the replacement
                    }
                }
            }

            return base.BeforeInsert(data);
        }

        public override TAct AfterInsert(TAct data)
        {
            this.UpdateOrCreateCondition(data);
            return base.AfterInsert(data);
        }

        public override TAct AfterUpdate(TAct data)
        {
            this.UpdateOrCreateCondition(data);
            return base.AfterUpdate(data);
        }

        private void UpdateOrCreateCondition(TAct data)
        {

            // Tag the data with our alertable tag
            if (data is CodedObservation cdo &&
                this.m_conceptRepository.IsMember(EmrConstants.EmrConditionTrigger, cdo.TypeConceptKey.Value))
            {
                var rct = data.LoadProperty(o => o.Participations).FirstOrDefault(o => o.ParticipationRoleKey == ActParticipationKeys.RecordTarget);
                var activeCondition = this.m_conditionRepository.Find(o => o.TypeConceptKey == ObservationTypeKeys.Condition && o.ValueKey == cdo.TypeConceptKey && o.ObsoletionTime == null && o.StatusConceptKey == StatusKeys.Active).FirstOrDefault();
                
                // Does the observation indicate the patient has this condition?
                if (this.m_conceptRepository.IsMember(EmrConstants.PatientIndicatorObservation, cdo.ValueKey.Value))
                {
                    activeCondition = activeCondition ?? new CodedObservation()
                    {
                        TypeConceptKey = ObservationTypeKeys.Condition,
                        ValueKey = cdo.TypeConceptKey,
                        StatusConceptKey = StatusKeys.Active,
                        Participations = new List<ActParticipation>()
                        {
                            new ActParticipation(ActParticipationKeys.RecordTarget, rct.PlayerEntityKey)
                        }
                    };

                    activeCondition.BatchOperation = BatchOperationType.InsertOrUpdate;
                    activeCondition.StatusConceptKey = StatusKeys.Active;
                }
                else if (activeCondition != null)
                {
                    // We want to invalidate the active condition
                    activeCondition.StatusConceptKey = StatusKeys.Completed;
                    activeCondition.BatchOperation = BatchOperationType.Update;
                }
                activeCondition.LoadProperty(o => o.Relationships).Add(new ActRelationship(ActRelationshipTypeKeys.RefersTo, data.Key));
                this.m_conditionRepository.Save(activeCondition); // Save the condition related to the act
            }
        }
    }
}
