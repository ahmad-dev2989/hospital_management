using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class PatientNumberGenerator : IPatientNumberGenerator
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<PatientNumberGenerator> _logger;
    private static readonly SemaphoreSlim _lock = new(1, 1);

    public PatientNumberGenerator(ApplicationDbContext dbContext, ILogger<PatientNumberGenerator> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<string> GenerateNextPatientNumberAsync(CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"HSP-{year}-";

            // Find all patient numbers for current year
            var currentYearNumbers = await _dbContext.Patients
                .AsNoTracking()
                .Where(p => p.PatientNumber.StartsWith(prefix))
                .Select(p => p.PatientNumber)
                .ToListAsync(cancellationToken);

            int highestSequence = 0;
            foreach (var num in currentYearNumbers)
            {
                var suffix = num.Substring(prefix.Length);
                if (int.TryParse(suffix, out int parsedSeq) && parsedSeq > highestSequence)
                {
                    highestSequence = parsedSeq;
                }
            }

            int nextSequence = highestSequence + 1;
            var generatedNumber = $"{prefix}{nextSequence:D5}";
            _logger.LogInformation("Generated sequential patient number: {PatientNumber}", generatedNumber);

            return generatedNumber;
        }
        finally
        {
            _lock.Release();
        }
    }
}
