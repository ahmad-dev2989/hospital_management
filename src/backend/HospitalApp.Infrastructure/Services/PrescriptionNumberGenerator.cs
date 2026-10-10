using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class PrescriptionNumberGenerator : IPrescriptionNumberGenerator
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<PrescriptionNumberGenerator> _logger;
    private static readonly SemaphoreSlim _lock = new(1, 1);

    public PrescriptionNumberGenerator(ApplicationDbContext dbContext, ILogger<PrescriptionNumberGenerator> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<string> GenerateNextPrescriptionNumberAsync(CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"RX-{year}-";

            var currentYearNumbers = await _dbContext.Prescriptions
                .AsNoTracking()
                .Where(p => p.PrescriptionNumber.StartsWith(prefix))
                .Select(p => p.PrescriptionNumber)
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
            _logger.LogInformation("Generated sequential prescription number: {PrescriptionNumber}", generatedNumber);

            return generatedNumber;
        }
        finally
        {
            _lock.Release();
        }
    }
}
