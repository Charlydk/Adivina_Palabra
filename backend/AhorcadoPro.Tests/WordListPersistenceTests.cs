using AhorcadoPro.Backend.Data;
using AhorcadoPro.Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace AhorcadoPro.Tests
{
    public class WordListPersistenceTests
    {
        private static ApplicationDbContext CreateContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .Options;
            return new ApplicationDbContext(options);
        }

        [Fact]
        public async Task WordList_CanBeSeedAndReloaded_FromInMemoryContext()
        {
            var dbName = $"WordListPersistence_{Guid.NewGuid()}";
            long savedId;

            // Seed
            using (var ctx = CreateContext(dbName))
            {
                var list = new WordList
                {
                    Name = "Unit 3 - Ecosystems",
                    OwnerAlias = "teacher1",
                    Items =
                    [
                        new WordListItem { Text = "ECOSYSTEM", Definition = "A biological community.", Category = "Biology", Position = 0 },
                        new WordListItem { Text = "PHOTOSYNTHESIS", Definition = null, Category = "Biology", Position = 1 }
                    ]
                };
                ctx.WordLists.Add(list);
                await ctx.SaveChangesAsync();
                savedId = list.Id;
            }

            // Reload and verify
            using (var ctx = CreateContext(dbName))
            {
                var reloaded = await ctx.WordLists
                    .Include(l => l.Items)
                    .FirstOrDefaultAsync(l => l.Id == savedId);

                Assert.NotNull(reloaded);
                Assert.Equal("Unit 3 - Ecosystems", reloaded.Name);
                Assert.Equal("teacher1", reloaded.OwnerAlias);
                Assert.Equal(2, reloaded.Items.Count);

                var first = reloaded.Items.OrderBy(i => i.Position).First();
                Assert.Equal("ECOSYSTEM", first.Text);
                Assert.Equal("A biological community.", first.Definition);
                Assert.Equal(0, first.Position);
            }
        }

        [Fact]
        public async Task WordListItem_CascadeDelete_RemovesItemsWhenListDeleted()
        {
            var dbName = $"WordListCascade_{Guid.NewGuid()}";
            long savedId;

            // Seed
            using (var ctx = CreateContext(dbName))
            {
                var list = new WordList
                {
                    Name = "Cascade Test List",
                    Items =
                    [
                        new WordListItem { Text = "ITEM1", Position = 0 },
                        new WordListItem { Text = "ITEM2", Position = 1 }
                    ]
                };
                ctx.WordLists.Add(list);
                await ctx.SaveChangesAsync();
                savedId = list.Id;
            }

            // Delete list and verify items are gone
            using (var ctx = CreateContext(dbName))
            {
                var list = await ctx.WordLists
                    .Include(l => l.Items)
                    .FirstAsync(l => l.Id == savedId);

                ctx.WordLists.Remove(list);
                await ctx.SaveChangesAsync();
            }

            using (var ctx = CreateContext(dbName))
            {
                var listExists = await ctx.WordLists.AnyAsync(l => l.Id == savedId);
                var orphanItems = await ctx.WordListItems.Where(i => i.WordListId == savedId).ToListAsync();

                Assert.False(listExists);
                Assert.Empty(orphanItems);
            }
        }

        [Fact]
        public async Task WordListItem_WithNullOptionalFields_PersistsAndReloadsCorrectly()
        {
            var dbName = $"WordListNulls_{Guid.NewGuid()}";
            long savedId;

            using (var ctx = CreateContext(dbName))
            {
                var list = new WordList
                {
                    Name = "Nullable Fields Test",
                    OwnerAlias = null,
                    Items =
                    [
                        new WordListItem { Text = "PALABRA", Definition = null, Category = null, Position = 0 }
                    ]
                };
                ctx.WordLists.Add(list);
                await ctx.SaveChangesAsync();
                savedId = list.Id;
            }

            using (var ctx = CreateContext(dbName))
            {
                var reloaded = await ctx.WordLists
                    .Include(l => l.Items)
                    .FirstAsync(l => l.Id == savedId);

                Assert.Null(reloaded.OwnerAlias);
                Assert.Single(reloaded.Items);
                Assert.Null(reloaded.Items[0].Definition);
                Assert.Null(reloaded.Items[0].Category);
            }
        }
    }
}
